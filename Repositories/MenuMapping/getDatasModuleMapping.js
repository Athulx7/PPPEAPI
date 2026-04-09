const sql = require("mssql");
async function getMenuMappingSystemroles(req, res) {
    const request = req.tenantDB.request()
    const result = await request.query(`
        	SELECT 
    role_code AS value,
    role_name AS label
FROM tbl_company_roles
WHERE is_active = 1
ORDER BY role_name
    `)
    return result.recordset
}

async function getMenuMappingDepartment(req) {
    const db = req.tenantDB
    const result = await db.request().query(`
            select depart_code as value, depart_name as label from tbl_department_mst  where is_active = 1
        `)

    return { data: result.recordset }
}

async function getMenuMappingDesignation(req) {
    const db = req.tenantDB
    const { department_code } = req.query
    const result = await db.request()
        .input("department_code", sql.VarChar, department_code)
        .query(`
            select  
                desig_code AS value,
                desig_name AS label
            from tbl_designation_mst
            where depart_code = @department_code
            and is_active = 1
        `)

    return { data: result.recordset }
}

async function getMenuMappingEmployees(req) {
    const db = req.tenantDB
    const { designation_code } = req.query
    const result = await db.request()
        .input("designation_code", sql.VarChar, designation_code)
        .query(`
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
  AND (@designation_code IS NULL OR e.designation_code = @designation_code)
        `)

    return { data: result.recordset }
}

async function getAllSubMenus(req) {
    const result = await req.tenantDB.request().query(`
        SELECT
    mm.main_menu_id,
    mm.menu_name,
    mm.display_order AS main_order,
    sm.sub_menu_id,
    sm.sub_menu_name,
    sm.route_path,
    sm.icon_name,
    sm.display_order AS sub_order
FROM tbl_main_menus mm
JOIN tbl_sub_menus sm 
    ON mm.main_menu_id = sm.main_menu_id
WHERE mm.is_active = 1 
  AND sm.is_active = 1
  AND mm.menu_name <> 'Dashboard'
ORDER BY mm.display_order, sm.display_order
    `)
    return { success: true, data: result.recordset }
}

async function loadMenuMapping(req) {
    const { type, code } = req.query
    console.log(`Loading menu mapping for ${type} with code ${code}`)
    const request = req.tenantDB.request()
    request.input('code', sql.VarChar, code)

    if (type === 'role') {
        const result = await request.query(`
            SELECT sub_menu_id FROM tbl_role_menus 
            WHERE role_code = @code
        `)
        return { success: true, data: result.recordset.map(r => r.sub_menu_id) }
    }

    if (type === 'designation') {
        const empInfo = await request.query(`
            SELECT TOP 1 role_code 
            FROM tbl_employee_mst
            WHERE designation_code = @code
              AND is_active = 1
        `)
        const roleCode = empInfo.recordset[0]?.role_code || null

        if (roleCode) {
            request.input('role_code', sql.VarChar, roleCode)
        }

        const result = await request.query(
            roleCode
                ? `
                    SELECT sub_menu_id FROM tbl_designation_menus
                    WHERE designation_code = @code

                    UNION

                    SELECT sub_menu_id FROM tbl_role_menus
                    WHERE role_code = @role_code
                  `
                : `
                    SELECT sub_menu_id FROM tbl_designation_menus
                    WHERE designation_code = @code
                  `
        )
        return { success: true, data: result.recordset.map(r => r.sub_menu_id) }
    }

    if (type === 'employee') {
        const empInfo = await request.query(`
            SELECT role_code, designation_code
            FROM tbl_employee_mst
            WHERE emp_code = @code
              AND is_active = 1
        `)

        const roleCode        = empInfo.recordset[0]?.role_code        || null
        const designationCode = empInfo.recordset[0]?.designation_code || null

        if (roleCode)        request.input('role_code',        sql.VarChar, roleCode)
        if (designationCode) request.input('designation_code', sql.VarChar, designationCode)

        const parts = [
            `SELECT sub_menu_id FROM tbl_employee_menus WHERE emp_code = @code`
        ]
        if (designationCode) parts.push(
            `SELECT sub_menu_id FROM tbl_designation_menus WHERE designation_code = @designation_code`
        )
        if (roleCode) parts.push(
            `SELECT sub_menu_id FROM tbl_role_menus WHERE role_code = @role_code`
        )

        const result = await request.query(parts.join('\n UNION \n'))
        return { success: true, data: result.recordset.map(r => r.sub_menu_id) }
    }

    return { success: false, message: 'Invalid mapping type' }
}

module.exports = {
    getMenuMappingSystemroles,
    getMenuMappingDepartment,
    getMenuMappingDesignation,
    getMenuMappingEmployees,
    getAllSubMenus,
    loadMenuMapping
}