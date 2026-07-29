const sql = require("mssql")

async function getPayrollSettingsModuleDataRepo(req) {
    const db = req.tenantDB;

    let config = {}
    try {
        const configResult = await db.request().query(`SELECT TOP 1 * FROM tbl_payrollsettings_module_config`)
        if (configResult.recordset && configResult.recordset.length > 0) {
            config = configResult.recordset[0]
        }
    } catch (err) {
        console.log("tbl_payrollsettings_module_config query note:", err.message)
    }

    const moduleResult = await db.request().query(`
        SELECT  id, module_key, table_name, label,
            icon,  description, is_core, display_order, plan_min, is_active
        FROM tbl_payroll_settings_modules WHERE is_active = 1 ORDER BY display_order
    `)

    const modules = moduleResult.recordset.map(module => {
        let enabled = true
        if (module.module_key !== "module_manager") {
            enabled = Boolean(config[module.module_key])
        }
        return {
            id: module.id,
            key: module.module_key,
            label: module.label,
            icon: module.icon,
            description: module.description,
            tableName: module.table_name,
            isCore: Boolean(module.is_core),
            enabled
        }
    })

    return { modules }
}

async function getModuleFieldsAndDataRepo(req) {
    const db = req.tenantDB;
    const { moduleKey } = req.params;

    const moduleReq = db.request()
    moduleReq.input("module_key", sql.VarChar, moduleKey)

    const moduleRes = await moduleReq.query(` SELECT id, module_key, table_name, label, icon, description, is_core
        FROM tbl_payroll_settings_modules
        WHERE module_key = @module_key AND is_active = 1 `)

    if (!moduleRes.recordset || moduleRes.recordset.length === 0) {
        return { module: null, fields: [], values: {} }
    }

    const moduleObj = moduleRes.recordset[0]
    const moduleId = moduleObj.id
    const tableName = moduleObj.table_name

    const fieldsReq = db.request()
    fieldsReq.input("module_id", sql.Int, moduleId)

    const fieldsRes = await fieldsReq.query(`
        SELECT id, module_id, field_key, label, field_type, unit, priority, default_value,
            options, regex, max_length, min_length, is_required, display_order, depends_on_field
        FROM tbl_payroll_settings_fields
        WHERE module_id = @module_id AND is_active = 1
        ORDER BY display_order
    `)

    const fields = []
    for (const f of fieldsRes.recordset) {
        let parsedOptions = f.options

        if (f.field_type === 'dropdown' && parsedOptions && typeof parsedOptions === 'string') {
            const trimmed = parsedOptions.trim()
            if (trimmed.toUpperCase().startsWith('SELECT')) {
                try {
                    const queryRes = await db.request().query(trimmed)
                    parsedOptions = queryRes.recordset.map(row => ({
                        value: row.value !== undefined ? row.value : (row.id || row.code || Object.values(row)[0]),
                        label: row.label !== undefined ? row.label : (row.name || row.description || Object.values(row)[1] || Object.values(row)[0])
                    }))
                } catch (err) {
                    console.error(`Error executing SQL dropdown query for field ${f.field_key}:`, err.message)
                    parsedOptions = []
                }
            } else {
                try {
                    parsedOptions = JSON.parse(parsedOptions)
                } catch (e) {
                    console.log('errror get Drp oPtion in payroll settings', e)
                }
            }
        }

        fields.push({
            id: f.id,
            moduleId: f.module_id,
            fieldKey: f.field_key,
            label: f.label,
            fieldType: f.field_type,
            unit: f.unit,
            priority: f.priority,
            defaultValue: f.default_value,
            options: parsedOptions,
            isRequired: Boolean(f.is_required),
            displayOrder: f.display_order,
            dependsOnField: f.depends_on_field
        })
    }

    let values = {}
    let ptSlabs = []
    let lwfMasters = []
    let esiMasters = []

    if (tableName) {
        try {
            const dataRes = await db.request().query(`SELECT TOP 1 * FROM ${tableName}`)
            if (dataRes.recordset && dataRes.recordset.length > 0) {
                values = dataRes.recordset[0]
            }
        } catch (err) {
            console.log(`Querying ${tableName} note:`, err.message)
        }
    }

    if (moduleKey === 'statutory') {
        try {
            const ptRes = await db.request().query(`SELECT 
    pt.id, 
    pt.state_code, 
    st.state_name, 
    pt.from_amount, 
    pt.to_amount, 
    pt.deduction_amount, 
    pt.gender 
FROM tbl_professional_tax_slab pt
LEFT JOIN tbl_state_mst st 
    ON pt.state_code = st.state_code
ORDER BY 
    pt.state_code, 
    pt.from_amount;`)
            ptSlabs = ptRes.recordset || []
        } catch (e) {
            console.log('ptSlabs query note:', e.message)
        }

        try {
            const lwfRes = await db.request().query(`SELECT 
    lwf.id, 
    lwf.state_code, 
    st.state_name, 
    lwf.employee_contribution, 
    lwf.employer_contribution, 
    lwf.deduction_frequency, 
    lwf.effective_from, 
    lwf.is_active 
FROM tbl_lwf_mst lwf
LEFT JOIN tbl_state_mst st 
    ON lwf.state_code = st.state_code
WHERE lwf.is_active = 1
ORDER BY 
    lwf.state_code`)
            lwfMasters = lwfRes.recordset || []
        } catch (e) {
            console.log('lwfMasters query note:', e.message)
        }

        try {
            const esiRes = await db.request().query(`SELECT id, wage_ceiling, employee_rate, employer_rate, effective_from, is_active FROM tbl_esi_mst WHERE is_active = 1 ORDER BY effective_from DESC`)
            esiMasters = esiRes.recordset || []
        } catch (e) {
            console.log('esiMasters query note:', e.message)
        }
    }

    return {
        module: {
            id: moduleObj.id,
            key: moduleObj.module_key,
            label: moduleObj.label,
            icon: moduleObj.icon,
            description: moduleObj.description,
            tableName: moduleObj.table_name,
            isCore: Boolean(moduleObj.is_core)
        },
        fields,
        values,
        ptSlabs,
        lwfMasters,
        esiMasters
    }
}

module.exports = { getPayrollSettingsModuleDataRepo, getModuleFieldsAndDataRepo }