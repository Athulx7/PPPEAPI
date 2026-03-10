const sql = require("mssql");

async function getMenuBasedControls(req) {
  const db = req.tenantDB
  const { mastercode } = req.params

  const headerRes = await db.request()
    .input("mastercode", sql.VarChar, mastercode)
    .query(`
        SELECT menu_id
        FROM tbl_master_header
        WHERE master_code = @mastercode
          AND is_active = 1
    `)

  if (!headerRes.recordset.length) {
    throw new Error("Invalid master code")
  }

  const menuid = headerRes.recordset[0].menu_id

  const controlsRes = await db.request()
    .input("menuid", sql.Int, menuid)
    .query(`
               SELECT *
               FROM tbl_module_field_controls
               WHERE sub_menu_id = @menuid
               ORDER BY priority
           `)

  const controls = controlsRes.recordset

  const dropdowns = {}

  for (const control of controls) {

    if (control.field_type === "dropdown" && control.dropdown_source) {

      const result = await db.request().query(control.dropdown_source)

      dropdowns[control.column_name] = result.recordset
    }
  }

  return {
    success: true,
    data: {
      controls,
      dropdowns
    }
  }

}

module.exports = { getMenuBasedControls }