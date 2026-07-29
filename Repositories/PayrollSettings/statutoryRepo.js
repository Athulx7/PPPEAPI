const sql = require("mssql");

async function getStatesForStatutoryRepo(req) {
    const db = req.tenantDB;
    const result = await db.request().query(`
select state_code as value, state_name as label from tbl_state_mst where is_active = 1
    `)

    return result.recordset
}

async function getStatutoryDataRepo(req) {
    const db = req.tenantDB
    let values = {}
    try {
        const configRes = await db.request().query(`
            SELECT TOP 1 
                enable_professional_tax,
                enable_lwf,
                enable_esi,
                enable_pf,
                enable_tds,
                enable_gratuity
            FROM tbl_payrollsettings_statutory_config
            WHERE is_active = 1
        `)
        values = configRes.recordset[0] || {};
    } catch (err) {
        console.log("Statutory config query note:", err.message)
    }

    let ptSlabs = []
    try {
        const ptRes = await db.request().query(`
            SELECT id, state_code, from_amount, to_amount, deduction_amount, gender, created_at
            FROM tbl_professional_tax_slab
            ORDER BY state_code, from_amount
        `)
        ptSlabs = ptRes.recordset
    } catch (err) {
        console.log("PT Slabs query note:", err.message)
    }

    let lwfMasters = []
    try {
        const lwfRes = await db.request().query(`
            SELECT id, state_code, employee_contribution, employer_contribution, deduction_frequency, effective_from, is_active, created_at
            FROM tbl_lwf_mst
            WHERE is_active = 1
            ORDER BY state_code
        `)
        lwfMasters = lwfRes.recordset
    } catch (err) {
        console.log("LWF query note:", err.message)
    }

    let esiMasters = []
    try {
        const esiRes = await db.request().query(`
            SELECT id, wage_ceiling, employee_rate, employer_rate, effective_from, is_active, created_at
            FROM tbl_esi_mst
            WHERE is_active = 1
            ORDER BY effective_from DESC
        `)
        esiMasters = esiRes.recordset
    } catch (err) {
        console.log("ESI query note:", err.message)
    }

    return { values, ptSlabs, lwfMasters, esiMasters }
}

async function savePtSlabRepo(req) {
    const db = req.tenantDB
    const { state_code, from_amount, to_amount, deduction_amount, gender } = req.body

    const request = db.request()
    request.input("state_code", sql.VarChar, state_code)
    request.input("from_amount", sql.Decimal(18, 2), from_amount || 0)
    request.input("to_amount", sql.Decimal(18, 2), to_amount || 0)
    request.input("deduction_amount", sql.Decimal(18, 2), deduction_amount || 0)
    request.input("gender", sql.VarChar, gender || 'All')

    await request.query(`
        INSERT INTO tbl_professional_tax_slab (state_code, from_amount, to_amount, deduction_amount, gender, created_at)
        VALUES (@state_code, @from_amount, @to_amount, @deduction_amount, @gender, GETDATE())
    `)

    return { success: true, message: "PT Slab added successfully" }
}

async function updatePtSlabRepo(req) {
    const db = req.tenantDB
    const { id } = req.params
    const { state_code, from_amount, to_amount, deduction_amount, gender } = req.body

    const request = db.request()
    request.input("id", sql.Int, id)
    request.input("state_code", sql.VarChar, state_code)
    request.input("from_amount", sql.Decimal(18, 2), from_amount || 0)
    request.input("to_amount", sql.Decimal(18, 2), to_amount || 0)
    request.input("deduction_amount", sql.Decimal(18, 2), deduction_amount || 0)
    request.input("gender", sql.VarChar, gender || 'All')

    await request.query(`
        UPDATE tbl_professional_tax_slab
        SET state_code = @state_code,
            from_amount = @from_amount,
            to_amount = @to_amount,
            deduction_amount = @deduction_amount,
            gender = @gender
        WHERE id = @id
    `)

    return { success: true, message: "PT Slab updated successfully" }
}

async function deletePtSlabRepo(req) {
    const db = req.tenantDB
    const { id } = req.params

    const request = db.request()
    request.input("id", sql.Int, id)
    await request.query(`DELETE FROM tbl_professional_tax_slab WHERE id = @id`)

    return { success: true, message: "PT Slab deleted successfully" }
}

async function saveLwfRepo(req) {
    const db = req.tenantDB
    const { state_code, employee_contribution, employer_contribution, deduction_frequency, effective_from } = req.body;

    const request = db.request()
    request.input("state_code", sql.VarChar, state_code)
    request.input("employee_contribution", sql.Decimal(18, 2), employee_contribution || 0)
    request.input("employer_contribution", sql.Decimal(18, 2), employer_contribution || 0)
    request.input("deduction_frequency", sql.VarChar, deduction_frequency || 'Monthly')
    request.input("effective_from", sql.Date, effective_from || new Date())

    await request.query(`
        INSERT INTO tbl_lwf_mst (state_code, employee_contribution, employer_contribution, deduction_frequency, effective_from, is_active, created_at)
        VALUES (@state_code, @employee_contribution, @employer_contribution, @deduction_frequency, @effective_from, 1, GETDATE())
    `);

    return { success: true, message: "LWF entry added successfully" }
}

async function updateLwfRepo(req) {
    const db = req.tenantDB
    const { id } = req.params
    const { state_code, employee_contribution, employer_contribution, deduction_frequency, effective_from } = req.body

    const request = db.request();
    request.input("id", sql.Int, id);
    request.input("state_code", sql.VarChar, state_code)
    request.input("employee_contribution", sql.Decimal(18, 2), employee_contribution || 0)
    request.input("employer_contribution", sql.Decimal(18, 2), employer_contribution || 0)
    request.input("deduction_frequency", sql.VarChar, deduction_frequency || 'Monthly')
    request.input("effective_from", sql.Date, effective_from || new Date())

    await request.query(`
        UPDATE tbl_lwf_mst
        SET state_code = @state_code,
            employee_contribution = @employee_contribution,
            employer_contribution = @employer_contribution,
            deduction_frequency = @deduction_frequency,
            effective_from = @effective_from
        WHERE id = @id
    `)

    return { success: true, message: "LWF entry updated successfully" }
}

async function deleteLwfRepo(req) {
    const db = req.tenantDB
    const { id } = req.params

    const request = db.request()
    request.input("id", sql.Int, id)
    await request.query(`DELETE FROM tbl_lwf_mst WHERE id = @id`)

    return { success: true, message: "LWF entry deleted successfully" }
}

async function saveEsiRepo(req) {
    const db = req.tenantDB
    const { wage_ceiling, employee_rate, employer_rate, effective_from } = req.body

    const request = db.request();
    request.input("wage_ceiling", sql.Decimal(18, 2), wage_ceiling || 21000)
    request.input("employee_rate", sql.Decimal(5, 2), employee_rate || 0.75)
    request.input("employer_rate", sql.Decimal(5, 2), employer_rate || 3.25)
    request.input("effective_from", sql.Date, effective_from || new Date())

    await request.query(`
        INSERT INTO tbl_esi_mst (wage_ceiling, employee_rate, employer_rate, effective_from, is_active, created_at)
        VALUES (@wage_ceiling, @employee_rate, @employer_rate, @effective_from, 1, GETDATE())
    `)

    return { success: true, message: "ESI configuration added successfully" }
}

module.exports = {
    getStatesForStatutoryRepo,
    getStatutoryDataRepo,
    savePtSlabRepo,
    updatePtSlabRepo,
    deletePtSlabRepo,
    saveLwfRepo,
    updateLwfRepo,
    deleteLwfRepo,
    saveEsiRepo
}
