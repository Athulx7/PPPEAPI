const sql = require("mssql")
async function getEmpMasterControls(req, res) {
    const db = req.tenantDB
    const result = await db.request().query(`
            SELECT *
            FROM tbl_emp_mst_controls
        `)

    const fields = result.recordset
    const autoCodeField = fields.find(f => f.is_auto_code)

    let autoCodePreview = null

    if (autoCodeField) {

        const tableName = "tbl_employee_mst"
        const columnName = autoCodeField.column_name
        const prefix = autoCodeField.code_prefix
        const codeLength = autoCodeField.code_length

        const autoCodeReq = db.request()

        autoCodeReq.input("prefix", sql.NVarChar, prefix)

        const query = `
        SELECT 
            ISNULL(
                MAX(
                    CAST(
                        SUBSTRING(${columnName}, LEN(@prefix) + 1, ${codeLength})
                        AS INT
                    )
                ), 0
            ) AS max_no
        FROM ${tableName}
        WHERE ${columnName} LIKE @prefix + '%'
    `
        const autoCodeResult = await autoCodeReq.query(query)
        const maxNo = autoCodeResult.recordset[0]?.max_no || 0
        const nextNo = maxNo + 1

        autoCodePreview = prefix + String(nextNo).padStart(codeLength, "0")
    }
    return { data: result.recordset, autoCodePreview: autoCodePreview }
}
async function getEmpMstDropdwonData(req, res) {
    const db = req.tenantDB
    const { column } = req.params
    const filters = req.query

    console.log('querry', filters)

    const fieldRes = await db.request()
        .input("column_name", sql.VarChar, column)
        .query(`
            SELECT dropdown_source, depends_on
            FROM tbl_emp_mst_controls
            WHERE column_name = @column_name
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
        console.log(filters)
        console.log(filters[field.depends_on])
        console.log('inside of the filter', depValue)

        if (!depValue) return []

        dataReq.input(field.depends_on, sql.NVarChar, depValue)
    }

    const result = await dataReq.query(finalQuery)

    return result.recordset
}


module.exports = { getEmpMasterControls, getEmpMstDropdwonData }