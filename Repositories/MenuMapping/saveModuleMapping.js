const sql = require("mssql")
async function saveMenuMapping(req) {
    const { type, code, subMenuIds } = req.body

    const tableMap = {
        role: { table: 'tbl_role_menus', col: 'role_code' },
        designation: { table: 'tbl_designation_menus', col: 'designation_code' },
        employee: { table: 'tbl_employee_menus', col: 'emp_code' },
    };
    const { table, col } = tableMap[type]

    let idsToSave = subMenuIds

    if (type === 'designation' || type === 'employee') {
        const r1 = req.tenantDB.request()
        r1.input('code', sql.VarChar, code)

        const empInfo = await r1.query(
            type === 'employee'
                ? `SELECT role_code, designation_code 
                   FROM tbl_employee_mst 
                   WHERE emp_code = @code AND is_active = 1`
                : `SELECT TOP 1 role_code 
                   FROM tbl_employee_mst 
                   WHERE designation_code = @code AND is_active = 1`
        )

        const roleCode = empInfo.recordset[0]?.role_code || null
        const designationCode = empInfo.recordset[0]?.designation_code || null

        const inheritedIds = new Set()

        if (roleCode) {
            const r2 = req.tenantDB.request()
            r2.input('role_code', sql.VarChar, roleCode)
            const roleMenus = await r2.query(
                `SELECT sub_menu_id FROM tbl_role_menus WHERE role_code = @role_code`
            )
            roleMenus.recordset.forEach(r => inheritedIds.add(r.sub_menu_id))
        }

        if (type === 'employee' && designationCode) {
            const r3 = req.tenantDB.request();
            r3.input('designation_code', sql.VarChar, designationCode)
            const desigMenus = await r3.query(
                `SELECT sub_menu_id FROM tbl_designation_menus 
                 WHERE designation_code = @designation_code`
            )
            desigMenus.recordset.forEach(r => inheritedIds.add(r.sub_menu_id))
        }

        idsToSave = subMenuIds.filter(id => !inheritedIds.has(id))
    }

    const request = req.tenantDB.request()
    request.input('code', sql.VarChar, code)
    await request.query(`DELETE FROM ${table} WHERE ${col} = @code`)

    if (idsToSave.length > 0) {
        const values = idsToSave.map(id => `('${code}', ${id})`).join(',')
        await request.query(
            `INSERT INTO ${table} (${col}, sub_menu_id) VALUES ${values}`
        )
    }

    return { success: true }
}

module.exports = { saveMenuMapping }