const sql = require("mssql");

async function getMasterContents(req) {
    const { menuid } = req.params

    const request = req.tenantDB.request()
    request.input("menuid", sql.Int, menuid)

    const headerResult = await request.query(`
            SELECT *
            FROM tbl_master_header
            WHERE menu_id = @menuid
              AND is_active = 1
        `)

    if (!headerResult.recordset.length) {
        throw new Error("Invalid master menu id")
    }

    const master = headerResult.recordset[0]
    const fieldsRequest = req.tenantDB.request()
    fieldsRequest.input("master_id", sql.Int, master.id)
    const fieldsResult = await fieldsRequest.query(`SELECT *
      FROM tbl_master_fields
      WHERE master_id=@master_id
      ORDER BY priority`)

    const fields = fieldsResult.recordset
    const autoCodeField = fields.find(f => f.is_auto_code === 1);

    let autoCodePreview = null

    if (autoCodeField) {
        const tableName = master.table_name
        const columnName = autoCodeField.column_name
        const prefix = autoCodeField.code_prefix
        const length = autoCodeField.code_length

        const autoCodeReq = req.tenantDB.request()

        const autoCodeResult = await autoCodeReq.query(`
            SELECT MAX(
                CAST(
                    SUBSTRING(${columnName}, ${prefix.length + 1}, ${length})
                    AS INT
                )
            ) AS max_no
            FROM ${tableName}
            WHERE ${columnName} LIKE '${prefix}%'
        `)

        const maxNo = autoCodeResult.recordset[0].max_no || 0
        const nextNo = maxNo + 1

        autoCodePreview = prefix + String(nextNo).padStart(length, "0")
    }

    return { master, fields: fields, autoCodePreview: autoCodePreview }
}

module.exports = { getMasterContents }