async function getLeaveTypesForLeaveSettingRepo(req) {
    const db = req.tenantDB
    const request = db.request()

    const leaveTypesResult = await request.query(`
        SELECT
            lt.id                   AS leave_type_id,
            lt.LeaveTypeCode        AS leave_code,
            lt.LeaveTypeName        AS leave_name,
            lt.Description          AS description,
            lt.LeaveCategoryCode    AS leave_category_code,
            lc.CategoryName         AS leave_category_name,
            lt.MaximumDays          AS maximum_days,
            lt.IsActive             AS is_active
        FROM tbl_leave_type lt
        LEFT JOIN tbl_leave_category lc
            ON lc.CategoryCode = lt.LeaveCategoryCode
        WHERE lt.IsActive = 1
        ORDER BY lt.LeaveTypeCode
    `)

    const leaveTypes = leaveTypesResult.recordset

    if (!leaveTypes.length) return []

    const leaveTypeIds = leaveTypes.map(l => l.leave_type_id).join(",")

    const fieldValuesResult = await db.request().query(`
        SELECT
            fv.LeaveTypeId,
            cfg.FieldKey,
            fv.FieldValue
        FROM tbl_leave_type_field_values fv
        INNER JOIN tbl_leave_type_config cfg
            ON cfg.id = fv.ConfigFieldId
        WHERE fv.LeaveTypeId IN (${leaveTypeIds})
        AND   cfg.IsActive = 1
    `)

    const fieldMap = {}
    fieldValuesResult.recordset.forEach(row => {
        if (!fieldMap[row.LeaveTypeId]) fieldMap[row.LeaveTypeId] = {}
        fieldMap[row.LeaveTypeId][row.FieldKey] = row.FieldValue
    })

    return leaveTypes.map(lt => {
        const fields = fieldMap[lt.leave_type_id] || {}
        return {
            leave_type_id: lt.leave_type_id,
            leave_code: lt.leave_code,
            leave_name: lt.leave_name,
            description: lt.description,
            leave_category_code: lt.leave_category_code,
            leave_category_name: lt.leave_category_name,
            maximum_days: lt.maximum_days,

            default_days: fields.defaultDays ? parseInt(fields.defaultDays) : 0,
            carry_forward: fields.carryForward === 'true',
            max_carry_forward: fields.maxCarryForward ? parseInt(fields.maxCarryForward) : 0,

            applicable_to: fields.applicableTo ? fields.applicableTo.split(",").map(s => s.trim()) : [],
        }
    })
}

module.exports = {
    getLeaveTypesForLeaveSettingRepo
}