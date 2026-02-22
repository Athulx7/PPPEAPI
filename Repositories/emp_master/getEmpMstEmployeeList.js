const sql = require("mssql")

async function getDepartmentForEmpMstList(req) {
    const db = req.tenantDB
    const result = await db.request().query(`
            select depart_code as value, depart_name as label from tbl_department_mst  where is_active = 1
        `)

    return { data: result.recordset }
}

async function getDesignantionForEmpList(req) {
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

async function gethierarchyLevelForEmpMstList(req) {
    const db = req.tenantDB
    const result = await db.request().query(`
            select hierarchy_code as value, hierarchy_name as label from tbl_hierarchy_mst where is_active = 1 `)

    return { data: result.recordset }
}

async function getEmployeeList(req) {
    const tenantDB = req.tenantDB
    const filters = req.query

    const request = tenantDB.request()

    let whereConditions = []

    if (filters.emp_code) {
        whereConditions.push("e.emp_code LIKE @emp_code")
        request.input("emp_code", sql.VarChar, `%${filters.emp_code}%`)
    }

    if (filters.emp_name) {
        whereConditions.push("(e.first_name + ' ' + e.last_name) LIKE @emp_name")
        request.input("emp_name", sql.VarChar, `%${filters.emp_name}%`)
    }

    if (filters.department_code) {
        whereConditions.push("e.department_code = @department_code")
        request.input("department_code", sql.VarChar, filters.department_code)
    }

    if (filters.designation_code) {
        whereConditions.push("e.designation_code = @designation_code")
        request.input("designation_code", sql.VarChar, filters.designation_code)
    }

    if (filters.hierarchy_code) {
        whereConditions.push("e.hierarchy_code = @hierarchy_code")
        request.input("hierarchy_code", sql.VarChar, filters.hierarchy_code)
    }

    if (filters.status) {
        if (filters.status === "Active") {
            whereConditions.push("e.is_active = 1")
        } else if (filters.status === "Inactive") {
            whereConditions.push("e.is_active = 0")
        }
    }

    const whereClause = whereConditions.length
        ? "WHERE " + whereConditions.join(" AND ")
        : ""

    const query = `
        SELECT 
            e.emp_code AS employee_code,
            e.first_name,
            e.last_name,
            e.email,
            e.mobile_number,
            d.depart_name AS department,
            des.desig_name AS designation,
            CASE 
                WHEN e.is_active = 1 THEN 'Active'
                ELSE 'Inactive'
            END AS employee_status,
            e.joining_date
        FROM tbl_employee_mst e
        LEFT JOIN tbl_department_mst d 
            ON e.department_code = d.depart_code
        LEFT JOIN tbl_designation_mst des
            ON e.designation_code = des.desig_code
        ${whereClause}
        ORDER BY e.created_at DESC
    `

    const result = await request.query(query)

    return result.recordset
}

async function getEmployeeById(req) {

    const tenantDB = req.tenantDB
    const { id } = req.params

    const request = tenantDB.request()

    request.input("emp_code", sql.VarChar, id)

    const result = await request.query(`
      SELECT *
      FROM tbl_employee_mst
      WHERE emp_code = @emp_code
   `)

    return result.recordset[0]
}



module.exports = { getDepartmentForEmpMstList, getDesignantionForEmpList, gethierarchyLevelForEmpMstList, getEmployeeList, getEmployeeById }