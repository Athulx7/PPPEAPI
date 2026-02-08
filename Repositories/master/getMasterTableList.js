const sql = require("mssql");

async function getMasterTableList(req) {
    const { menuid } = req.params

    const request = req.tenantDB.request()
    request.input("menuid", sql.Int, menuid)

    const headerResult = await request.query(`
        SELECT 
            id,
            menu_id,
            master_code,
            table_name,
            header_name,
            list_title
        FROM tbl_master_header
        WHERE menu_id = @menuid
          AND is_active = 1
    `);

    if (!headerResult.recordset.length) {
        throw new Error("Invalid master menu id");
    }

    const master = headerResult.recordset[0];

    const fieldsRequest = req.tenantDB.request();
    fieldsRequest.input("master_id", sql.Int, master.id);

    const fieldsResult = await fieldsRequest.query(`
        SELECT
            column_name,
            label,
            field_type,
            show_in_list,
            list_label,
            priority
        FROM tbl_master_fields
        WHERE master_id = @master_id
          AND show_in_list = 1
        ORDER BY priority
    `);

    const dataResult = await req.tenantDB.request().query(`
        SELECT *
        FROM ${master.table_name}
        ORDER BY id DESC
    `);

    return {
        master: {
            menu_id: master.menu_id,
            master_code: master.master_code,
            table_name: master.table_name,
            header_name: master.header_name,
            list_title: master.list_title
        },
        fields: fieldsResult.recordset,
        data: dataResult.recordset
    };
}

module.exports = { getMasterTableList };
