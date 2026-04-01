async function getAssignmentDropdowns(req) {
    const db = req.tenantDB

    const [designationRes, employeeRes, structureRes] = await Promise.all([

        db.request().query(`
            SELECT 
                desig_code AS value,
                desig_name AS label
                
            FROM tbl_designation_mst
            WHERE is_active = 1
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

WHERE e.is_active = 1;
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