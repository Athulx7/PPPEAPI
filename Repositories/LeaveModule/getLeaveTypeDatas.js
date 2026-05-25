const sql = require("mssql")
async function getLeaveTypeFOrTableRepo(req, res) {
    const request = req.tenantDB.request()
    const result = await request.query(`
             SELECT
                lt.id,
                lt.LeaveTypeCode,
                lt.LeaveTypeName,
                lt.Description,
                lt.LeaveCategoryCode,
                lc.CategoryName        AS LeaveCategoryName,
                lt.accural_code,
                at.accural_name     AS AccrualTypeName,
                lt.MaximumDays,
                lt.IsActive,
                lt.CreatedDate,
                lt.ModifiedDate
            FROM dbo.tbl_leave_type lt
            LEFT JOIN dbo.tbl_leave_category      lc ON lc.CategoryCode = lt.LeaveCategoryCode
            LEFT JOIN dbo.tbl_leave_accrual_types at ON at.accural_code = lt.accural_code
            ORDER BY lt.LeaveTypeCode
    `)
    return result.recordset
}

async function getLeaveTypeWithID(req) {

    const db = req.tenantDB
    const { id } = req.params

    try {
        const request = db.request()
        request.input("id", sql.Int, id)
        const baseResult = await request.query(`
            SELECT
                lt.id,
                lt.LeaveTypeCode AS leaveTypeCode,
                lt.LeaveTypeName AS leaveTypeName,
                lt.Description AS leaveTypeDescription,
                lt.LeaveCategoryCode AS leaveCategory,
                lt.accural_code AS accrualType,
                lt.MaximumDays AS maximumDays,
                lt.IsActive AS isActive
            FROM tbl_leave_type lt
            WHERE lt.id = @id
        `)

        if (!baseResult.recordset.length) {
            throw new Error("Leave type not found")
        }

        const leaveType = { ...baseResult.recordset[0] }

        const fieldValuesRequest = db.request()

        fieldValuesRequest.input(
            "leaveTypeId",
            sql.Int,
            id
        )

        const fieldValuesResult = await fieldValuesRequest.query(`
            SELECT
                cfg.FieldKey,
                fv.FieldValue
            FROM tbl_leave_type_field_values fv
            INNER JOIN tbl_leave_type_config cfg
                ON cfg.id = fv.ConfigFieldId
            WHERE fv.LeaveTypeId = @leaveTypeId
        `)

        fieldValuesResult.recordset.forEach((row) => {
            leaveType[row.FieldKey] = row.FieldValue
        })

        return leaveType

    }
    catch (err) {
        console.log("Repository error in getLeaveTypeWithID:", err)
        throw err
    }
}


module.exports = { getLeaveTypeFOrTableRepo, getLeaveTypeWithID }