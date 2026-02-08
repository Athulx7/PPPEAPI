const sql = require("mssql");

async function getMasterById(req) {
    const { menuid, id } = req.params;
    const db = req.tenantDB;

    // 1️⃣ Get master header
    const headerReq = db.request();
    headerReq.input("menuid", sql.Int, menuid);

    const headerRes = await headerReq.query(`
        SELECT *
        FROM tbl_master_header
        WHERE menu_id = @menuid
          AND is_active = 1
    `);

    if (!headerRes.recordset.length) {
        throw new Error("Invalid master menu");
    }

    const master = headerRes.recordset[0];
    const tableName = master.table_name;

    // 2️⃣ Fetch row by ID
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
