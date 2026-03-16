async function getSlryComponentDropdownData(req) {
    const db = req.tenantDB
    const result = await db.request().query(`SELECT
id,
component_code,
component_name,
type_code,
calc_code,
fixed_amount,
percentage_value,
base_component_code,
formula_expression
FROM tbl_salary_components
WHERE status = 1
ORDER BY priority`)
    return result.recordset
}

async function getSlryComponentCalculationTypeDropdownData(req) {
    const db = req.tenantDB
    const result = await db.request().query(`SELECT
calc_code AS value,
calc_name AS label,
requires_formula,
requires_percentage
FROM tbl_slry_comp_calculation_type
WHERE is_active = 1`)
    return result.recordset
}

async function getDropdownComponentType(req) {
    const db = req.tenantDB
    const result = await db.request().query(`SELECT
type_code AS value,
type_name AS label
FROM tbl_salary_component_type
WHERE is_active = 1`)

    return result.recordset
}

// salarystructure/dropdownComponentType

module.exports = { getSlryComponentDropdownData, getSlryComponentCalculationTypeDropdownData, getDropdownComponentType }