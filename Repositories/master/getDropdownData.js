const sql = require("mssql")

async function getDropdownData(req) {
    const { menuid, column } = req.params
    const filters = req.query
    const db = req.tenantDB

    const masterRes = await db.request()
        .input("menuid", sql.Int, menuid)
        .query(`
            SELECT id
            FROM tbl_master_header
            WHERE menu_id = @menuid
              AND is_active = 1
        `)

    if (!masterRes.recordset.length) {
        throw new Error("Invalid master")
    }

    const masterId = masterRes.recordset[0].id

    const fieldRes = await db.request()
        .input("master_id", sql.Int, masterId)
        .input("column_name", sql.VarChar, column)
        .query(`
            SELECT dropdown_source, depends_on
            FROM tbl_master_fields
            WHERE master_id = @master_id
              AND column_name = @column_name
        `)

    if (!fieldRes.recordset.length) {
        throw new Error("Dropdown field not found")
    }

    const field = fieldRes.recordset[0]
    if (!field.dropdown_source) return []

    let finalQuery = field.dropdown_source
    const dataReq = db.request()

    if (field.depends_on) {
        const depValue = filters[field.depends_on]
        if (!depValue) return []

        dataReq.input(field.depends_on, sql.Int, depValue)
    }

    const result = await dataReq.query(finalQuery)
    return result.recordset
}

module.exports = { getDropdownData }
