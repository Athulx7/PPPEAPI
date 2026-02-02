const  sql  = require("mssql");

async function getSideMenu(req) {
    const { role_code } = req.user;

    const request = req.tenantDB.request();
    request.input("role_code", sql.VarChar, role_code);

    const result = await request.query(`
        SELECT 
            mm.menu_name AS main_menu_name,
            sm.sub_menu_id,
            sm.sub_menu_name,
            sm.route_path,
            sm.icon_name AS sub_icon,
            sm.display_order
        FROM tbl_role_menus rm
        JOIN tbl_sub_menus sm ON rm.sub_menu_id = sm.sub_menu_id
        JOIN tbl_main_menus mm ON sm.main_menu_id = mm.main_menu_id
        WHERE rm.role_code = @role_code
          AND sm.is_side_menu = 1
          AND sm.is_active = 1
          AND mm.is_active = 1
        ORDER BY sm.display_order ,mm.display_order;
    `);

    return result.recordset;
}

async function getSystemRoles(req) {
    const request = req.tenantDB.request();
    const result = await request.query(`
        	SELECT role_code, role_name, default_route
      FROM tbl_company_roles
        WHERE is_active = 1
    `);
    return result.recordset;
}
module.exports = { getSideMenu, getSystemRoles };
