
function calculateSalary(components = []) {
    const values = {}

    // ── FIXED ───────────────────────────────
    components.forEach(c => {
        if (!c.formula_expression && !c.percentage_value) {
            values[c.component_code] = parseFloat(c.fixed_amount) || 0
        }
    })

    // ── PERCENTAGE ──────────────────────────
    components.forEach(c => {
        if (c.percentage_value && c.base_component_code) {
            const base = values[c.base_component_code] || 0
            values[c.component_code] =
                (parseFloat(c.percentage_value) / 100) * base
        }
    })

    // ── FORMULA ─────────────────────────────
    components.forEach(c => {
        if (c.formula_expression) {
            let formula = c.formula_expression

            Object.keys(values).forEach(code => {
                formula = formula.replace(
                    new RegExp(`\\b${code}\\b`, 'g'),
                    values[code]
                )
            })

            try {
                values[c.component_code] = eval(formula)
            } catch {
                values[c.component_code] = 0
            }
        }
    })

    // ── BREAKDOWN ───────────────────────────
    let add = 0, sub = 0, employer = 0

    components.forEach(c => {
        const val = values[c.component_code] || 0

        if (c.payroll_impact === 'add') add += val
        else if (c.payroll_impact === 'sub') sub += val
        else if (c.payroll_impact === 'employer') employer += val
    })

    return {
        values,
        net: add - sub,
        breakdown: { add, sub, employer }
    }
}

async function getAllAssignments(req) {
    const db = req.tenantDB

    const result = await db.request().query(`
        SELECT 
            a.id,
            a.assignment_type AS type,
            a.target_code,
            a.structure_id,
            a.effective_date,
            a.end_date,
            a.status,
            a.assigned_by,
            a.created_at,

            s.structure_name,

            CASE 
                WHEN a.assignment_type = 'employee' 
                    THEN CONCAT(e.first_name, ' ', e.last_name, ' (', e.emp_code, ')')
                WHEN a.assignment_type = 'designation' 
                    THEN d.desig_name
                ELSE NULL
            END AS target_name,

            -- Employee fields
            e.emp_code,
            CONCAT(e.first_name, ' ', e.last_name) AS emp_name,

            ed.desig_name AS employee_designation,
            dp.depart_name AS employee_department,

            d.desig_name AS designation_name,

            -- 🔥 Components JSON
            (
                SELECT 
                    c.component_name,
                    c.component_code,
                    sc.calc_code,
                    sc.fixed_amount,
                    sc.percentage_value,
                    sc.formula_expression,
                    sc.component_order,
                    ct.type_name,
                    ct.payroll_impact
                FROM tbl_salary_structure_components sc
                LEFT JOIN tbl_salary_components c
                    ON c.id = sc.component_id
                LEFT JOIN tbl_salary_component_type ct
                    ON ct.type_code = c.type_code
                WHERE sc.structure_id = a.structure_id
                ORDER BY sc.component_order
                FOR JSON PATH
            ) AS components,

            -- 🔥 Employees under designation
            (
                SELECT 
                    e2.emp_code,
                    CONCAT(e2.first_name, ' ', e2.last_name) AS emp_name,
                    ed2.desig_name AS designation,
                    dp2.depart_name AS department
                FROM tbl_employee_mst e2
                LEFT JOIN tbl_designation_mst ed2
                    ON e2.designation_code = ed2.desig_code
                LEFT JOIN tbl_department_mst dp2
                    ON e2.department_code = dp2.depart_code
                WHERE 
                    a.assignment_type = 'designation'
                    AND e2.designation_code = a.target_code
                FOR JSON PATH
            ) AS mapped_employees

        FROM tbl_salary_structure_assignment a

        LEFT JOIN tbl_salary_structure s 
            ON s.id = a.structure_id

        LEFT JOIN tbl_employee_mst e 
            ON e.emp_code = a.target_code 
            AND a.assignment_type = 'employee'

        LEFT JOIN tbl_designation_mst ed
            ON e.designation_code = ed.desig_code

        LEFT JOIN tbl_department_mst dp
            ON e.department_code = dp.depart_code

        LEFT JOIN tbl_designation_mst d 
            ON d.desig_code = a.target_code 
            AND a.assignment_type = 'designation'

        ORDER BY a.created_at DESC
    `)

    // 🔥 PROCESS DATA
    const finalData = result.recordset.map(row => {
        let components = []
        let employees = []

        try {
            components = JSON.parse(row.components || '[]')
        } catch {
            components = []
        }

        try {
            employees = JSON.parse(row.mapped_employees || '[]')
        } catch {
            employees = []
        }

        // 🔥 CALCULATE SALARY
        const salary = calculateSalary(components)

        return {
            ...row,
            components,
            mapped_employees: employees,

            // 🔥 salary data
            salary_values: salary.values,
            net_salary: salary.net,
            salary_breakdown: salary.breakdown
        }
    })

    return finalData
}

module.exports = { getAllAssignments }