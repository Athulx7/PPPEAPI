async function getSalaryStructureList(req) {
    const db = req.tenantDB

    const result = await db.request().query(`
        SELECT 
    s.id,
    s.structure_code,
    s.structure_name,
    s.description,
    s.effective_date,
    s.status,
    s.created_at,

    CONCAT(e.first_name, ' (', e.emp_code, ')') AS created_by,

    COUNT(c.id) AS component_count,

    -- ✅ Check if structure is used
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM tbl_salary_structure_assignment a 
            WHERE a.structure_id = s.id
        ) THEN 1 
        ELSE 0 
    END AS is_used,

    -- ✅ Editable flag
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM tbl_salary_structure_assignment a 
            WHERE a.structure_id = s.id
        ) THEN 0 
        ELSE 1 
    END AS is_editable,

    -- ✅ Deletable flag
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM tbl_salary_structure_assignment a 
            WHERE a.structure_id = s.id
        ) THEN 0 
        ELSE 1 
    END AS is_deletable

FROM tbl_salary_structure s

LEFT JOIN tbl_salary_structure_components c 
    ON s.id = c.structure_id

LEFT JOIN tbl_employee_mst e
    ON s.created_by = e.emp_code   -- adjust if needed

GROUP BY 
    s.id,
    s.structure_code,
    s.structure_name,
    s.description,
    s.effective_date,
    s.status,
    s.created_at,
    e.first_name,
    e.emp_code

ORDER BY s.created_at DESC;
    `)

    return result.recordset
}

module.exports = { getSalaryStructureList }