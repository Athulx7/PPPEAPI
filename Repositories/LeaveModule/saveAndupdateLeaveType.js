const sql = require("mssql")

async function saveLeaveType(req) {

    const db = req.tenantDB
    const data = req.body

    const {
        leaveTypeCode,
        leaveTypeName,
        leaveTypeDescription = null,
        leaveCategory,
        accrualType = null,
        maximumDays = null,
        leaveApprover = null,
        ...conditionalFields
    } = data

    const transaction = new sql.Transaction(db)

    try {

        await transaction.begin()

        const duplicateCheck = await new sql.Request(transaction)
            .input("code", sql.VarChar(10), leaveTypeCode.trim().toUpperCase())
            .query(`
                SELECT COUNT(1) AS cnt
                FROM tbl_leave_type
                WHERE LeaveTypeCode = @code
            `)

        if (duplicateCheck.recordset[0].cnt > 0) {
            throw new Error("Leave type code already exists")
        }

        // Insert leave type

        const insertResult = await new sql.Request(transaction)
            .input("LeaveTypeCode", sql.VarChar(10), leaveTypeCode.trim().toUpperCase())
            .input("LeaveTypeName", sql.NVarChar(100), leaveTypeName.trim())
            .input("Description", sql.NVarChar(255), leaveTypeDescription)
            .input("LeaveCategoryCode", sql.VarChar(10), leaveCategory)
            .input("accural_code", sql.VarChar(10), accrualType || null)
            .input("MaximumDays", sql.Int, maximumDays ? parseInt(maximumDays) : null)
            .input("approver_heihrarchy_code", sql.VarChar(10), leaveApprover || null)
            .query(`
                INSERT INTO tbl_leave_type
                (
                    LeaveTypeCode,
                    LeaveTypeName,
                    Description,
                    LeaveCategoryCode,
                    accural_code,
                    MaximumDays,
                    approver_heihrarchy_code,
                    IsActive,
                    CreatedDate
                )
                OUTPUT INSERTED.id
                VALUES
                (
                    @LeaveTypeCode,
                    @LeaveTypeName,
                    @Description,
                    @LeaveCategoryCode,
                    @accural_code,
                    @MaximumDays,
                    @approver_heihrarchy_code,
                    1,
                    GETDATE()
                )
            `)

        const leaveTypeId = insertResult.recordset[0].id

        // Fetch config fields

        const configResult = await new sql.Request(transaction)
            .query(`
                SELECT id, FieldKey
                FROM tbl_leave_type_config
                WHERE IsActive = 1
                AND DependsOnFlag IS NOT NULL
                AND DependsOnFlag != 'accrualTypeSelected'
            `)

        const fieldMap = {}
        configResult.recordset.forEach((row) => {
            fieldMap[row.FieldKey] = row.id
        })

        // Insert conditional fields

        for (const [fieldKey, fieldValue] of Object.entries(conditionalFields)) {
            if (!fieldMap[fieldKey]) continue
            if (fieldValue === null || fieldValue === undefined || fieldValue === "") {
                continue
            }

            await new sql.Request(transaction)
                .input("LeaveTypeId", sql.Int, leaveTypeId)
                .input("ConfigFieldId", sql.Int, fieldMap[fieldKey])
                .input("FieldValue", sql.NVarChar(sql.MAX), String(fieldValue))
                .query(`
                    INSERT INTO tbl_leave_type_field_values
                    (
                        LeaveTypeId,
                        ConfigFieldId,
                        FieldValue
                    )
                    VALUES
                    (
                        @LeaveTypeId,
                        @ConfigFieldId,
                        @FieldValue
                    )
                `)
        }
        await transaction.commit()
        return { success: true, id: leaveTypeId }
    }
    catch (err) {
        await transaction.rollback()
        console.log("Repository error in saveLeaveType:", err)
        throw err
    }
}

async function updateLeaveType(req) {

    const db = req.tenantDB
    const leaveTypeId = parseInt(req.params.id)
    const {
        leaveTypeCode,
        leaveTypeName,
        leaveTypeDescription = null,
        leaveCategory,
        accrualType = null,
        maximumDays = null,
        leaveApprover = null,
        ...conditionalFields
    } = req.body

    const transaction = new sql.Transaction(db)

    try {

        await transaction.begin()

        const existCheck = await new sql.Request(transaction)
            .input("id", sql.Int, leaveTypeId)
            .query(`
                SELECT COUNT(1) AS cnt
                FROM tbl_leave_type
                WHERE id = @id
            `)

        if (!existCheck.recordset[0].cnt) {
            throw new Error("Leave type not found")
        }

        // Duplicate code check

        const duplicateCheck = await new sql.Request(transaction)
            .input("code",sql.VarChar(10),leaveTypeCode.trim().toUpperCase())
            .input("id",sql.Int,leaveTypeId)
            .query(`
                SELECT COUNT(1) AS cnt
                FROM tbl_leave_type
                WHERE LeaveTypeCode = @code
                AND id != @id
            `)

        if (duplicateCheck.recordset[0].cnt > 0) {
            throw new Error("Leave type code already exists")
        }

        await new sql.Request(transaction)
            .input("id", sql.Int, leaveTypeId)
            .input( "LeaveTypeCode", sql.VarChar(10),leaveTypeCode.trim().toUpperCase())
            .input("LeaveTypeName", sql.NVarChar(100), leaveTypeName.trim())
            .input("Description",sql.NVarChar(255),leaveTypeDescription)
            .input( "LeaveCategoryCode",sql.VarChar(10),leaveCategory)
            .input("accural_code",sql.VarChar(10),accrualType || null)
            .input("MaximumDays",sql.Int,maximumDays ? parseInt(maximumDays) : null)
            .input("approver_heihrarchy_code", sql.VarChar(10), leaveApprover || null)
            .query(`
                UPDATE tbl_leave_type
                SET
                    LeaveTypeCode = @LeaveTypeCode,
                    LeaveTypeName = @LeaveTypeName,
                    Description = @Description,
                    LeaveCategoryCode = @LeaveCategoryCode,
                    accural_code = @accural_code,
                    MaximumDays = @MaximumDays,
                    approver_heihrarchy_code = @approver_heihrarchy_code,
                    ModifiedDate = GETDATE()
                WHERE id = @id
            `)

        const configResult = await new sql.Request(transaction)
            .query(`
                SELECT id, FieldKey
                FROM tbl_leave_type_config
                WHERE IsActive = 1
                AND DependsOnFlag IS NOT NULL
                AND DependsOnFlag != 'accrualTypeSelected'
            `)

        const fieldMap = {}
        configResult.recordset.forEach((row) => {
            fieldMap[row.FieldKey] = row.id
        })

        // Upsert conditional fields

        const updatedConfigIds = []

        for (const [fieldKey, fieldValue] of Object.entries(conditionalFields)) {
            if (!fieldMap[fieldKey]) continue
            if (fieldValue === null || fieldValue === undefined || fieldValue === "") { continue }

            const configFieldId = fieldMap[fieldKey]
            updatedConfigIds.push(configFieldId)
            await new sql.Request(transaction)
                .input("LeaveTypeId", sql.Int, leaveTypeId)
                .input("ConfigFieldId", sql.Int, configFieldId)
                .input("FieldValue", sql.NVarChar(sql.MAX), String(fieldValue))
                .query(`
                    MERGE tbl_leave_type_field_values AS target
                    USING (
                        SELECT
                            @LeaveTypeId AS LeaveTypeId,
                            @ConfigFieldId AS ConfigFieldId
                    ) AS source
                    ON target.LeaveTypeId = source.LeaveTypeId
                    AND target.ConfigFieldId = source.ConfigFieldId

                    WHEN MATCHED THEN
                        UPDATE SET
                            FieldValue = @FieldValue

                    WHEN NOT MATCHED THEN
                        INSERT
                        (
                            LeaveTypeId,
                            ConfigFieldId,
                            FieldValue
                        )
                        VALUES
                        (
                            @LeaveTypeId,
                            @ConfigFieldId,
                            @FieldValue
                        );
                `)
        }

        // Delete old conditional values

        if (updatedConfigIds.length > 0) {
            const placeholders = updatedConfigIds.map((_, index) => `@cfId${index}`).join(",")
            const deleteRequest = new sql.Request(transaction)
            deleteRequest.input("leaveTypeId", sql.Int, leaveTypeId)
            updatedConfigIds.forEach((id, index) => {
                deleteRequest.input(`cfId${index}`, sql.Int, id)
            })
            await deleteRequest.query(`
                DELETE fv
                FROM tbl_leave_type_field_values fv
                INNER JOIN tbl_leave_type_config cfg
                    ON cfg.id = fv.ConfigFieldId
                WHERE fv.LeaveTypeId = @leaveTypeId
                AND cfg.DependsOnFlag IS NOT NULL
                AND cfg.DependsOnFlag != 'accrualTypeSelected'
                AND fv.ConfigFieldId NOT IN (${placeholders})
            `)
        } else {
            await new sql.Request(transaction)
                .input("leaveTypeId", sql.Int, leaveTypeId)
                .query(`
                    DELETE fv
                    FROM tbl_leave_type_field_values fv
                    INNER JOIN tbl_leave_type_config cfg
                        ON cfg.id = fv.ConfigFieldId
                    WHERE fv.LeaveTypeId = @leaveTypeId
                    AND cfg.DependsOnFlag IS NOT NULL
                    AND cfg.DependsOnFlag != 'accrualTypeSelected'
                `)
        }
        await transaction.commit()
        return { success: true, id: leaveTypeId }
    }
    catch (err) {
        await transaction.rollback()
        console.log("Repository error in updateLeaveType:", err)
        throw err
    }
}

async function deleteLeaveTypeById(req) {
    const db = req.tenantDB
    console.log('inside of the detele repo')
    const leaveTypeId = parseInt(req.params.id)
    const transaction = new sql.Transaction(db)
    try {
        await transaction.begin()
        const result = await new sql.Request(transaction)
            .input("id",sql.Int,leaveTypeId)
            .query(`
                UPDATE tbl_leave_type
                SET
                    IsActive = 0,
                    ModifiedDate = GETDATE()
                WHERE id = @id
                AND IsActive = 1
            `)
        if (result.rowsAffected[0] === 0) {
            throw new Error("Leave type not found or already inactive" )
        }
        await transaction.commit()
        return {
            success: true,
            id: leaveTypeId
        }
    }
    catch (err) {
        await transaction.rollback()
        console.log("Repository error in deleteLeaveTypeById:",err)
        throw err
    }
}
module.exports = {
    saveLeaveType, updateLeaveType, deleteLeaveTypeById
}