async function getSalaryStructureById(req) {
    const db = req.tenantDB
    const { id } = req.params

    const result = await db.request()
        .input('id', id)
        .query(`
            SELECT 
                s.id,
                s.structure_code,
                s.structure_name,
                s.description,
                s.effective_date,
                s.status,

                c.component_id,
                sc.component_code,
                sc.component_name,
                sc.type_code,

                c.calc_code,
                c.fixed_amount,
                c.percentage_value,
                c.formula_expression,
                bc.component_code AS base_component_code

            FROM tbl_salary_structure s
            LEFT JOIN tbl_salary_structure_components c 
                ON s.id = c.structure_id
            LEFT JOIN tbl_salary_components sc
                ON sc.id = c.component_id
            LEFT JOIN tbl_salary_components bc
                ON bc.id = c.base_component_id

            WHERE s.id = @id
        `)

    return result.recordset
}

module.exports = { getSalaryStructureById }