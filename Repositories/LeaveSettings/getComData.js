const sql = require("mssql");

async function FungetDepartMentForLeavesettings(req, res) {
    const db = req.tenantDB
    const result = await db.request().query(`
            select depart_code as value, depart_name as label from tbl_department_mst  where is_active = 1
        `)

    return { data: result.recordset }
}

async function FunGetDesignantionForLeavesettings(req, res) {
    const db = req.tenantDB
    const { department_code } = req.query
    const result = await db.request()
        .input("department_code", sql.VarChar, department_code)
        .query(`
                select  
                    desig_code AS value,
                    desig_name AS label
                from tbl_designation_mst
                where depart_code = @department_code
                and is_active = 1
            `)

    return { data: result.recordset }
}

async function FunGetHierarchyLevelForLeavesettings(req, res) {
    const db = req.tenantDB
    const result = await db.request()
        .query(`
                select  
                    hierarchy_code AS value,
                    hierarchy_name AS label
                from tbl_hierarchy_mst 
                where is_active = 1
            `)
    return { data: result.recordset }
}

async function FunGetEmpTypeForLeavesettings(req, res) {
    const db = req.tenantDB
    const result = await db.request()
        .query(`
               select  
                    employee_type_code AS value,
                    name AS label
                from tbl_employee_type_mst 
                where is_active = 1
            `)
    return { data: result.recordset }
}

async function FunGetEmployeesForLeaveSettings(req, res) {
    const db = req.tenantDB
    const {
        department_code,
        designation_code,
        hierarchy_code,
        employee_type_code
    } = req.query

    const result = await db.request()
        .input("department_code", sql.VarChar, department_code || null)
        .input("designation_code", sql.VarChar, designation_code || null)
        .input("hierarchy_code", sql.VarChar, hierarchy_code || null)
        .input("employee_type_code", sql.VarChar, employee_type_code || null)
        .query(`
            SELECT
                emp_code AS value,
                CONCAT(first_name, ' ', ISNULL(last_name, '')) AS label,
                *
            FROM tbl_employee_mst
            WHERE is_active = 1
                AND (@department_code IS NULL OR department_code = @department_code)
                AND (@designation_code IS NULL OR designation_code = @designation_code)
                AND (@hierarchy_code IS NULL OR hierarchy_code = @hierarchy_code)
                AND (@employee_type_code IS NULL OR employee_type_code = @employee_type_code)
            ORDER BY first_name
        `)

    return { data: result.recordset }
}

async function FunGetAllEmplForLeavesettings(req, res) {
    const db = req.tenantDB
    const result = await db.request()
        .query(`  select  
                    e.emp_code AS value,
                    CONCAT(e.first_name, ' ', ISNULL(e.last_name, '')) AS label,
                    e.*,
                    et.name AS employment_type
                from tbl_employee_mst e
                left join tbl_employee_type_mst et
                    on et.employee_type_code = e.employee_type_code
                where e.is_active = 1
            `)
    return { data: result.recordset }
}

async function FunGetAllDesignationForLeavesettings(req, res) {
    const db = req.tenantDB
    const result = await db.request()
        .query(`  select  
                    desig_code AS value,
                   desig_name AS label
                from tbl_designation_mst 
                where is_active = 1
            `)
    return { data: result.recordset }
}

module.exports = {
    FungetDepartMentForLeavesettings,
    FunGetDesignantionForLeavesettings,
    FunGetHierarchyLevelForLeavesettings,
    FunGetEmpTypeForLeavesettings,
    FunGetEmployeesForLeaveSettings,
    FunGetAllEmplForLeavesettings,
    FunGetAllDesignationForLeavesettings
}