const sql = require("mssql");

async function getMenuBasedControls(req) {
  const db = req.tenantDB
  const { menuid } = req.params

  // get controls
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

  // collect dropdown data
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