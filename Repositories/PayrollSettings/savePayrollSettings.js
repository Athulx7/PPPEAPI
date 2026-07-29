const sql = require("mssql")

async function saveModuleSettingsRepo(req) {
    const db = req.tenantDB
    const { moduleKey, data } = req.body

    if (!moduleKey || !data) {
        throw new Error("moduleKey and data are required")
    }

    const moduleReq = db.request()
    moduleReq.input("module_key", sql.VarChar, moduleKey)

    const moduleRes = await moduleReq.query(`
        SELECT table_name FROM tbl_payroll_settings_modules WHERE module_key = @module_key
    `)

    if (!moduleRes.recordset || moduleRes.recordset.length === 0) {
        throw new Error(`Module ${moduleKey} not found`)
    }

    const tableName = moduleRes.recordset[0].table_name
    if (!tableName) {
        throw new Error(`No table_name configured for module ${moduleKey}`)
    }

    const existingCheck = await db.request().query(`SELECT TOP 1 id FROM ${tableName}`)

    if (existingCheck.recordset && existingCheck.recordset.length > 0) {
        const id = existingCheck.recordset[0].id
        const updateFields = []
        const request = db.request()
        request.input("id", sql.Int, id)

        for (const key in data) {
            if (key !== "id" && key !== "updated_at" && key !== "created_at") {
                updateFields.push(`${key} = @${key}`)
                request.input(key, data[key])
            }
        }

        if (updateFields.length > 0) {
            await request.query(`
                UPDATE ${tableName}
                SET ${updateFields.join(", ")}, updated_at = GETDATE()
                WHERE id = @id
            `)
        }
    } else {
        const columns = []
        const valuePlaceholders = []
        const request = db.request()

        for (const key in data) {
            if (key !== "id" && key !== "updated_at" && key !== "created_at") {
                columns.push(key)
                valuePlaceholders.push(`@${key}`)
                request.input(key, data[key])
            }
        }

        if (columns.length > 0) {
            await request.query(`
                INSERT INTO ${tableName}
                (${columns.join(", ")}, updated_at)
                VALUES
                (${valuePlaceholders.join(", ")}, GETDATE())
            `)
        }
    }

    return { success: true, message: `Module settings saved successfully` }
}

module.exports = { saveModuleSettingsRepo }
