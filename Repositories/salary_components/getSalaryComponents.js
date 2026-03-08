const sql = require("mssql")

async function getSalaryComponents(req) {
    const db = req.tenantDB
    const result = await db.request().query(`
        SELECT *
        FROM tbl_salary_components
        WHERE status = 1
        ORDER BY priority
    `)
    return result.recordset
}

module.exports = { getSalaryComponents }