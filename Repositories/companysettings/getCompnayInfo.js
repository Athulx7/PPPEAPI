async function getCompanyINforepo(req, res) {
    const db = req.tenantDB
    const result = await db.request().query(`
            SELECT TOP 1 *
            FROM tbl_company_settings
        `)

    return { data: result.recordset[0] }
}

module.exports = { getCompanyINforepo }