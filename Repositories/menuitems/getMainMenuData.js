const sql = require('mssql')
async function getMainMenuData(req) {
    const { role_code, emp_code, designation_code } = req.user;
    const request = req.tenantDB.request();

    request.input("role_code", sql.VarChar, role_code);
    request.input("emp_code", sql.VarChar, emp_code);
    request.input("designation_code", sql.VarChar, designation_code);

    const result = await request.query(`
        SELECT DISTINCT
            mm.main_menu_id,
            mm.menu_name       AS category,
            mm.display_order   AS main_order,
            sm.sub_menu_id,
            sm.sub_menu_name   AS label,
            sm.route_path,
            sm.icon_name,
            sm.display_order   AS sub_order
        FROM tbl_sub_menus sm
        JOIN tbl_main_menus mm ON sm.main_menu_id = mm.main_menu_id
        WHERE sm.is_active = 1
          AND mm.is_active = 1
          AND mm.main_menu_id <> 1
          AND sm.sub_menu_id IN (
              -- Role menus (always included)
              SELECT sub_menu_id FROM tbl_role_menus
              WHERE role_code = @role_code

              UNION

              -- Designation menus (if any mapped)
              SELECT sub_menu_id FROM tbl_designation_menus
              WHERE designation_code = @designation_code

              UNION

              -- Employee menus (if any mapped)
              SELECT sub_menu_id FROM tbl_employee_menus
              WHERE emp_code = @emp_code
          )
        ORDER BY mm.display_order, sm.display_order
    `);

    const menuMap = {};
    result.recordset.forEach(row => {
        if (!menuMap[row.category]) {
            menuMap[row.category] = { category: row.category, items: [] };
        }
        menuMap[row.category].items.push({
            label: row.label,
            routes: row.route_path,
            icon: row.icon_name
        });
    });
    return Object.values(menuMap);
}
module.exports = { getMainMenuData }