async function getAssignmentDropdowns(req) {
    const db = req.tenantDB

    const [designationRes, employeeRes, structureRes] = await Promise.all([

        db.request().query(`
           SELECT 
    d.desig_code AS value,
    d.desig_name AS label

FROM tbl_designation_mst d

WHERE d.is_active = 1

AND NOT EXISTS (
    SELECT 1
    FROM tbl_salary_structure_assignment a
    WHERE a.assignment_type = 'designation'
      AND a.target_code = d.desig_code
)
        `),

        db.request().query(`
        SELECT 
    e.emp_code AS value,
    CONCAT(e.first_name, ' ', e.last_name) AS label,
    d.desig_name AS designation,
    dp.depart_name AS department

FROM tbl_employee_mst e

LEFT JOIN tbl_designation_mst d
    ON e.designation_code = d.desig_code

LEFT JOIN tbl_department_mst dp
    ON e.department_code = dp.depart_code

WHERE e.is_active = 1

AND NOT EXISTS (
    SELECT 1 
    FROM tbl_salary_structure_assignment a
    WHERE a.assignment_type = 'employee'
      AND a.target_code = e.emp_code
)

AND NOT EXISTS (
    SELECT 1 
    FROM tbl_salary_structure_assignment a
    WHERE a.assignment_type = 'designation'
      AND a.target_code = e.designation_code
)
        `),

        db.request().query(`
            SELECT 
                id AS value,
                structure_name AS label,
                structure_code
            FROM tbl_salary_structure
            WHERE status = 1
        `)
    ])

    return {
        designations: designationRes.recordset,
        employees: employeeRes.recordset,
        structures: structureRes.recordset
    }
}

module.exports = { getAssignmentDropdowns }