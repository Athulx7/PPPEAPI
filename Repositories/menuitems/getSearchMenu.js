const sql = require('mssql')
async function getSearchMenu(req) {

    const { role_code } = req.user
    const { q = "" } = req.query

    const request = req.tenantDB.request()
    request.input("emp_code", sql.VarChar, req.user.user_code);
    request.input("search", sql.VarChar, q)
    request.input("role_code", sql.VarChar, role_code)
    const result = await request.query(`
        SELECT
    mm.menu_name AS category,
    sm.sub_menu_name AS title,
    sm.route_path AS route
FROM tbl_sub_menus sm
INNER JOIN tbl_main_menus mm
    ON mm.main_menu_id = sm.main_menu_id
INNER JOIN tbl_employee_mst emp
    ON emp.emp_code = @emp_code
WHERE
    sm.is_active = 1
    AND mm.is_active = 1

    AND sm.sub_menu_name LIKE '%' + @search + '%'

    AND sm.sub_menu_id IN
    (
    SELECT sub_menu_id
    FROM tbl_role_menus
    WHERE role_code  = @role_code

        UNION

        SELECT sub_menu_id
        FROM tbl_designation_menus
        WHERE designation_code = emp.designation_code

        UNION

        SELECT sub_menu_id
        FROM tbl_employee_menus
        WHERE emp_code = @emp_code
    )
ORDER BY
    mm.display_order,
    sm.display_order `)
    return result.recordset
}

module.exports = { getSearchMenu }