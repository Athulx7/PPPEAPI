async function getFullEmpForChat (req, res) {
    const db = req.tenantDB
    const result = await db.query(`
        SELECT 
    e.emp_code,
    e.first_name + ' ' + e.last_name AS emp_name,
    e.email,
    d.desig_name AS designation,
    dp.depart_name AS department,
    e.gender,
    et.name

FROM tbl_employee_mst e

LEFT JOIN tbl_designation_mst d 
    ON e.designation_code = d.desig_code

LEFT JOIN tbl_department_mst dp 
    ON e.department_code = dp.depart_code

LEFT JOIN tbl_employee_type_mst et 
    ON e.employee_type_code = et.employee_type_code

WHERE e.is_active = 1

    `)

    return result.recordset
}

module.exports = { getFullEmpForChat }