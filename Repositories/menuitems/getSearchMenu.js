const sql = require('mssql')
async function getSearchMenu(req) {

    const { role_code } = req.user
    const { q = "" } = req.query

    const request = req.tenantDB.request()
    request.input("role_code", sql.VarChar, role_code)
    request.input("search", sql.VarChar, q)
    const result = await request.query(`
        SELECT 
    mm.menu_name      AS category,
    sm.sub_menu_name  AS title,
    sm.route_path     AS route
FROM tbl_role_menus rm
JOIN tbl_sub_menus sm ON rm.sub_menu_id = sm.sub_menu_id
JOIN tbl_main_menus mm ON sm.main_menu_id = mm.main_menu_id
WHERE rm.role_code = @role_code
  AND sm.is_active = 1
  AND mm.is_active = 1
  and mm.main_menu_id<>1
  AND sm.sub_menu_name LIKE @search + '%'
ORDER BY sm.sub_menu_name
        `)
    return result.recordset;
}

module.exports = { getSearchMenu }