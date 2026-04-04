async function getAssignmentById(req) {
    const db = req.tenantDB
    const { id } = req.params
    const { emp_code } = req.query

    const result = await db.request()
        .input('id', id)
        .query(`
            SELECT * 
            FROM tbl_salary_structure_assignment
            WHERE id = @id
        `)

    const assignment = result.recordset[0]
    if (!assignment) return null

    if (assignment.assignment_type === 'designation' && emp_code) {

        // get employee info
        const empRes = await db.request()
            .input('emp_code', emp_code)
            .query(`
                SELECT 
                    emp_code,
                    CONCAT(first_name, ' ', last_name) AS emp_name
                FROM tbl_employee_mst
                WHERE emp_code = @emp_code
            `)

        const emp = empRes.recordset[0]

        return {
            ...assignment,

            type: 'employee',
            target_code: emp.emp_code,
            target_name: `${emp.emp_name} (${emp.emp_code})`
        }
    }

    const full = await db.request()
        .input('id', id)
        .query(`
            SELECT 
                a.*,
                s.structure_name,
                CONCAT(e.first_name, ' ', e.last_name, ' (', e.emp_code, ')') AS target_name

            FROM tbl_salary_structure_assignment a
            LEFT JOIN tbl_salary_structure s ON s.id = a.structure_id
            LEFT JOIN tbl_employee_mst e ON e.emp_code = a.target_code

            WHERE a.id = @id
        `)

    return full.recordset[0]
}

module.exports = { getAssignmentById }