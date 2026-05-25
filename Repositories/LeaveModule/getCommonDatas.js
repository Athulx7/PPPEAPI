const sql = require("mssql")
async function getLeaveMasterCategoryRepo(req, res) {
    const request = req.tenantDB.request()
    const result = await request.query(`
        	 select  
                categorycode AS value,
                categoryname AS label
            from tbl_leave_category
            where isactive = 1
    `)
    return result.recordset
}

async function getLeaveCategoryDataBasedSelectionRepo(req,res){
    const { categorycode } = req.params
    console.log('categorycode', categorycode)
    const request = req.tenantDB.request()
    request.input("categorycode", sql.VarChar, categorycode)
    const result = await request.query(`
                SELECT  
    lc.categorycode AS value,
    lc.categoryname AS label,
    lc.*,
    at.accural_name,
    at.accural_code
FROM tbl_leave_category lc
LEFT JOIN tbl_leave_accrual_types at
    ON lc.accural_type_code = at.accural_code
WHERE lc.isactive = 1 and lc.categorycode = @categorycode`)
    return result.recordset
}

async function getLeaveconfigRepo(req, res) {
    const request = req.tenantDB.request()
    const result = await request.query(`
        SELECT
    id,
    FieldKey,
    FieldLabel,
    InputType,
    DropdownSource,
    StaticOptions,
    DependsOnFlag,
    Section,
    DisplayOrder,
    IsRequired,
    Placeholder
FROM dbo.tbl_leave_type_config
WHERE IsActive = 1
ORDER BY
    CASE Section
        WHEN 'basic'   THEN 1
        WHEN 'accrual' THEN 2
        WHEN 'rules'   THEN 3
        ELSE 4
    END,
    DisplayOrder;`)
    return result.recordset
}

async function getLeaveMasterAccuralTypeRepo(req, res) {
    const request = req.tenantDB.request()
    const result = await request.query(`
        	 select  
                accural_code AS value,
                accural_name AS label
            from tbl_leave_accrual_types
            where is_active = 1
    `)
    return result.recordset
}

module.exports = { 
    getLeaveMasterCategoryRepo, getLeaveCategoryDataBasedSelectionRepo, getLeaveconfigRepo, getLeaveMasterAccuralTypeRepo }