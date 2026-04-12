const sql = require("mssql");

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

async function getFavourites(req) {
    const { user_code } = req.user

    const request = req.tenantDB.request()
    request.input('emp_code', sql.VarChar, user_code)

    const result = await request.query(`
        SELECT f.route_path, f.created_at,
               sm.sub_menu_name, sm.icon_name, sm.sub_menu_id
        FROM tbl_menu_favourites f
        JOIN tbl_sub_menus sm ON sm.route_path = f.route_path
        WHERE f.emp_code = @emp_code
          AND sm.is_active = 1
        ORDER BY f.created_at DESC
    `)
    return { success: true, data: result.recordset }
}

async function toggleFavourite(req) {
    const { user_code } = req.user
    const { route_path } = req.body
    console.log(`Toggling favourite for user_code: ${user_code}, route_path: ${route_path}`)

    const checkReq = req.tenantDB.request()
    checkReq.input('emp_code', sql.VarChar, user_code)
    checkReq.input('route_path', sql.VarChar, route_path)
    const check = await checkReq.query(`
        SELECT COUNT(*) as cnt 
        FROM tbl_menu_favourites
        WHERE emp_code = @emp_code AND route_path = @route_path
    `)

    if (check.recordset[0].cnt > 0) {
        const delReq = req.tenantDB.request()
        delReq.input('emp_code', sql.VarChar, user_code)
        delReq.input('route_path', sql.VarChar, route_path)
        await delReq.query(`
            DELETE FROM tbl_menu_favourites
            WHERE emp_code = @emp_code AND route_path = @route_path
        `)
        return { success: true, action: 'removed' }
    }

    const countReq = req.tenantDB.request()
    countReq.input('emp_code', sql.VarChar, user_code)
    const countRes = await countReq.query(`
        SELECT COUNT(*) as cnt FROM tbl_menu_favourites
        WHERE emp_code = @emp_code
    `)

    if (countRes.recordset[0].cnt >= 10) {
        const fifoReq = req.tenantDB.request()
        fifoReq.input('emp_code', sql.VarChar, user_code)
        await fifoReq.query(`
            DELETE FROM tbl_menu_favourites
            WHERE emp_code = @emp_code
              AND route_path = (
                SELECT TOP 1 route_path 
                FROM tbl_menu_favourites
                WHERE emp_code = @emp_code
                ORDER BY created_at ASC
              )
        `)
    }

    const insertReq = req.tenantDB.request()
    insertReq.input('emp_code', sql.VarChar, user_code)
    insertReq.input('route_path', sql.VarChar, route_path)
    await insertReq.query(`
        INSERT INTO tbl_menu_favourites (emp_code, route_path)
        VALUES (@emp_code, @route_path)
    `)
    return { success: true, action: 'added' }
}

module.exports = { getSideMenu, getSystemRoles, getFavourites, toggleFavourite }
