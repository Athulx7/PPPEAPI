const sql = require("mssql")

async function saveMasterData(req) {
    const { menuid } = req.params
    const payload = req.body
    const db = req.tenantDB

    const headerReq = db.request()
    headerReq.input("menuid", sql.Int, menuid)

    const headerRes = await headerReq.query(`
        SELECT *
        FROM tbl_master_header
        WHERE menu_id = @menuid
          AND is_active = 1
    `)

    if (!headerRes.recordset.length) {
        throw new Error("Invalid master menu")
    }

    const master = headerRes.recordset[0]
    const tableName = master.table_name

    const fieldsReq = db.request()
    fieldsReq.input("master_id", sql.Int, master.id)

    const fieldsRes = await fieldsReq.query(`
        SELECT *
        FROM tbl_master_fields
        WHERE master_id = @master_id
    `)

    const fields = fieldsRes.recordset

    const isEdit = !!payload.id

    for (const field of fields) {
        if (field.is_auto_code === 1 && !isEdit) {
            const prefix = field.code_prefix
            const length = field.code_length
            const column = field.column_name

            const codeReq = db.request();
            const codeRes = await codeReq.query(`
                SELECT MAX(
                    CAST(
                        SUBSTRING(${column}, ${prefix.length + 1}, ${length})
                        AS INT
                    )
                ) AS max_no
                FROM ${tableName}
                WHERE ${column} LIKE '${prefix}%'
            `)

            const maxNo = codeRes.recordset[0].max_no || 0
            const nextCode =
                prefix + String(maxNo + 1).padStart(length, "0")

            payload[column] = nextCode
        }
    }

    const validColumns = fields.map(f => f.column_name)

    const columns = []
    const values = []
    const updates = []

    validColumns.forEach(col => {
        if (payload[col] !== undefined) {
            columns.push(col)
            values.push(payload[col])
            updates.push(`${col} = @${col}`)
        }
    })

    const request = db.request()

    values.forEach((val, idx) => {
        request.input(columns[idx], val)
    })

    let query

    if (!isEdit) {
        query = `
            INSERT INTO ${tableName} (${columns.join(", ")})
            OUTPUT INSERTED.*
            VALUES (${columns.map(c => "@" + c).join(", ")})
        `
    }
    else {
        request.input("id", payload.id);
        query = `
            UPDATE ${tableName}
            SET ${updates.join(", ")}
            WHERE id = @id;

            SELECT * FROM ${tableName} WHERE id = @id;
        `
    }

    const result = await request.query(query)

    return result.recordset[0]
}

module.exports = { saveMasterData }