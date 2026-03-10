const sql = require("mssql");

async function getMasterById(req) {
    const { mastercode, id } = req.params;
    const db = req.tenantDB;

    const headerReq = db.request();
    headerReq.input("mastercode", sql.VarChar, mastercode);

    const headerRes = await headerReq.query(`
        SELECT *
        FROM tbl_master_header
        WHERE master_code = @mastercode
          AND is_active = 1
    `);

    if (!headerRes.recordset.length) {
        throw new Error("Invalid master menu");
    }

    const master = headerRes.recordset[0];
    const tableName = master.table_name;

    const dataReq = db.request();
    dataReq.input("id", sql.Int, id);

    const dataRes = await dataReq.query(`
        SELECT *
        FROM ${tableName}
        WHERE id = @id
    `);

    if (!dataRes.recordset.length) {
        throw new Error("Record not found");
    }

    return dataRes.recordset[0];
}

module.exports = { getMasterById };
