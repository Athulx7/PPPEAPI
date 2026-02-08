const sql = require('mssql')
async function getMainMenuData(req) {
    const { role_code } = req.user

    const request = req.tenantDB.request()
    request.input("role_code", sql.VarChar, role_code)

    const result = await request.query(`
        SELECT
      mm.main_menu_id,
      mm.menu_name AS category,
      mm.display_order AS main_order,

      sm.sub_menu_id,
      sm.sub_menu_name AS label,
      sm.route_path,
      sm.icon_name,
      sm.display_order AS sub_order

    FROM tbl_role_menus rm
    JOIN tbl_sub_menus sm ON rm.sub_menu_id = sm.sub_menu_id
    JOIN tbl_main_menus mm ON sm.main_menu_id = mm.main_menu_id

    WHERE rm.role_code = @role_code
      AND sm.is_active = 1
      AND mm.is_active = 1
      AND mm.main_menu_id <> 1
    ORDER BY mm.display_order, sm.display_order
        `)
    const menuMap = {}
    result.recordset.forEach(row => {
        if (!menuMap[row.category]) {
            menuMap[row.category] = {
                category: row.category,
                items: []
            }
        }

        menuMap[row.category].items.push({
            label: row.label,
            routes: row.route_path,
            icon: row.icon
        })
    })
    return Object.values(menuMap)
}

module.exports = { getMainMenuData }