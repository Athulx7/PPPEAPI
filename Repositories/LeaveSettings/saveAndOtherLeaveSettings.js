const sql = require("mssql")

async function getLeaveAllocationsRepo(req) {
    const db = req.tenantDB
    const { emp_code, department, designation, employment_type } = req.query

    const request = db.request()

    let whereClause = `WHERE la.is_active = 1`

    if (emp_code) {
        request.input("emp_code", sql.VarChar(20), emp_code)
        whereClause += ` AND la.emp_code = @emp_code`
    }

    if (department) {
        request.input("department", sql.VarChar(50), department)
        whereClause += ` AND dep.depart_code = @department`
    }

    if (designation) {
        request.input("designation", sql.VarChar(50), designation)
        whereClause += ` AND des.desig_code = @designation`
    }

    if (employment_type) {
        request.input("employment_type", sql.VarChar(50), employment_type)
        whereClause += ` AND et.employee_type_code = @employment_type`
    }

    const result = await request.query(`
         SELECT
            la.id,
            la.emp_code,

            CONCAT(
                ISNULL(e.first_name, ''),
                CASE
                    WHEN e.last_name IS NOT NULL
                    THEN ' ' + e.last_name
                    ELSE ''
                END
            ) AS emp_name,

            dep.depart_name AS department,
            des.desig_name AS designation,
            et.name AS employment_type,

            la.leave_type_id,

            lt.LeaveTypeCode AS leave_code,
            lt.LeaveTypeName AS leave_name,

            lc.CategoryName AS leave_category,

            la.allocated_days,
            la.used_days,
            la.pending_days,

            la.valid_from,
            la.valid_to,

            la.is_carry_forward,
            la.carry_forward_days,
            la.carry_forward_expiry,

            la.allocation_mode,
            la.bulk_batch_id,

            la.note,
            la.is_active,

            la.created_by,
            la.created_date,
            la.modified_by,
            la.modified_date

        FROM tbl_leave_settings_allocation la

        INNER JOIN tbl_employee_mst e
            ON e.emp_code = la.emp_code

        LEFT JOIN tbl_department_mst dep
            ON dep.depart_code = e.department_code

        LEFT JOIN tbl_designation_mst des
            ON des.desig_code = e.designation_code

        LEFT JOIN tbl_employee_type_mst et
            ON et.employee_type_code = e.employee_type_code

        INNER JOIN tbl_leave_type lt
            ON lt.id = la.leave_type_id

        LEFT JOIN tbl_leave_category lc
            ON lc.CategoryCode = lt.LeaveCategoryCode

        ${whereClause}

        ORDER BY
            CONCAT(
                ISNULL(e.first_name, ''),
                CASE
                    WHEN e.last_name IS NOT NULL
                    THEN ' ' + e.last_name
                    ELSE ''
                END
            ),
            lt.LeaveTypeName
    `)

    return result.recordset
}

async function getLeaveAllocationByIdRepo(req) {
    const db = req.tenantDB
    const { id } = req.params

    const request = db.request()
    request.input("id", sql.Int, id)

    const result = await request.query(`
        SELECT
            la.*,
            e.emp_name,
            e.Designation       AS designation,
            e.Department        AS department,
            e.employee_type_code AS employment_type,
            lt.LeaveTypeCode    AS leave_code,
            lt.LeaveTypeName    AS leave_name
        FROM tbl_leave_settings_allocation la
        INNER JOIN tbl_employee_mst e
            ON e.emp_code = la.emp_code
        INNER JOIN tbl_leave_type lt
            ON lt.id = la.leave_type_id
        WHERE la.id = @id
    `)

    if (!result.recordset.length) throw new Error("Allocation not found")
    return result.recordset[0]
}


async function saveSingleAllocationRepo(req) {
    const db = req.tenantDB
    const { emp_code, allocations } = req.body
    console.log('empcode amd allocations', { emp_code, allocations })

    if (!emp_code || !Array.isArray(allocations) || allocations.length === 0) {
        throw new Error("emp_code and allocations array are required")
    }

    const transaction = new sql.Transaction(db)

    try {
        await transaction.begin()

        const insertedIds = []

        for (const leaf of allocations) {
            const {
                leave_type_id,
                allocated_days,
                valid_from,
                valid_to,
                note = null
            } = leaf

            // Check for existing active allocation for same emp + leave + overlapping period
            const dupCheck = await new sql.Request(transaction)
                .input("emp_code", sql.VarChar(20), emp_code)
                .input("leave_type_id", sql.Int, leave_type_id)
                .input("valid_from", sql.Date, valid_from)
                .input("valid_to", sql.Date, valid_to)
                .query(`
                    SELECT COUNT(1) AS cnt
                    FROM tbl_leave_settings_allocation
                    WHERE emp_code      = @emp_code
                    AND   leave_type_id = @leave_type_id
                    AND   is_active     = 1
                    AND   valid_from   <= @valid_to
                    AND   valid_to     >= @valid_from
                `)

            if (dupCheck.recordset[0].cnt > 0) {
                throw new Error(
                    `Active allocation already exists for leave_type_id ${leave_type_id} in this period`
                )
            }

            const insertResult = await new sql.Request(transaction)
                .input("emp_code", sql.VarChar(20), emp_code)
                .input("leave_type_id", sql.Int, leave_type_id)
                .input("allocated_days", sql.Decimal(5, 1), parseFloat(allocated_days))
                .input("valid_from", sql.Date, valid_from)
                .input("valid_to", sql.Date, valid_to)
                .input("note", sql.NVarChar(500), note)
                .query(`
                    INSERT INTO tbl_leave_settings_allocation
                    (
                        emp_code, leave_type_id, allocated_days,
                        valid_from, valid_to, allocation_mode, note,
                        is_active, created_date
                    )
                    OUTPUT INSERTED.id
                    VALUES
                    (
                        @emp_code, @leave_type_id, @allocated_days,
                        @valid_from, @valid_to, 'single', @note,
                        1, GETDATE()
                    )
                `)

            insertedIds.push(insertResult.recordset[0].id)
        }

        await transaction.commit()
        return { success: true, ids: insertedIds, count: insertedIds.length }

    } catch (err) {
        await transaction.rollback()
        throw err
    }
}


//check for conflicts before bulk save
async function previewBulkConflictsRepo(req) {
    const db = req.tenantDB
    const {
        apply_to,
        department,
        designation,
        employment_type,
        valid_from,
        valid_to,
        allocations
    } = req.body

    let target_value = null
    if (apply_to === 'department') {
        target_value = department
    } else if (apply_to === 'designation') {
        target_value = designation
    } else if (apply_to === 'employment_type') {
        target_value = employment_type
    }

    if (!apply_to || !valid_from || !valid_to || !Array.isArray(allocations) || allocations.length === 0) {
        throw new Error("apply_to, valid_from, valid_to and allocations are required")
    }

    const empRequest = db.request()
    let empQuery = `
        SELECT emp_code, employee_type_code, first_name, last_name
        FROM tbl_employee_mst
        WHERE is_active = 1
    `

    if (apply_to === 'department' && target_value) {
        empRequest.input("target", sql.NVarChar(100), target_value)
        empQuery += ` AND department_code = @target`
    } else if (apply_to === 'designation' && target_value) {
        empRequest.input("target", sql.NVarChar(100), target_value)
        empQuery += ` AND designation_code = @target`
    } else if (apply_to === 'employment_type' && target_value) {
        empRequest.input("target", sql.NVarChar(50), target_value)
        empQuery += ` AND employee_type_code = @target`
    }

    const empResult = await empRequest.query(empQuery)
    const targetEmployees = empResult.recordset
    //conflics finding
    const leaveTypeIds = allocations.map(a => a.leave_type_id).join(",")

    const conflicts = await db.request()
        .input("valid_from", sql.Date, valid_from)
        .input("valid_to", sql.Date, valid_to)
        .query(`
            SELECT
                la.id,
                la.emp_code,
                e.first_name + ' ' + ISNULL(e.last_name, '') AS emp_name,
                la.leave_type_id,
                lt.LeaveTypeName,
                la.allocated_days,
                la.valid_from,
                la.valid_to,
                la.bulk_batch_id,
                bb.apply_to,
                bb.target_value
            FROM tbl_leave_settings_allocation la
            INNER JOIN tbl_employee_mst e ON e.emp_code = la.emp_code
            INNER JOIN tbl_leave_type lt ON lt.id = la.leave_type_id
            LEFT JOIN tbl_leave_setting_bulk_batch bb ON bb.id = la.bulk_batch_id
            WHERE la.is_active = 1
                AND la.leave_type_id IN (${leaveTypeIds})
                AND la.valid_from <= @valid_to
                AND la.valid_to >= @valid_from
                AND la.emp_code IN ('${targetEmployees.map(e => e.emp_code).join("','")}')
            ORDER BY e.emp_code, la.leave_type_id
        `)

    return {
        target_employees_count: targetEmployees.length,
        target_employees: targetEmployees,
        conflicting_records: conflicts.recordset,
        conflict_count: conflicts.recordset.length,
        warning: conflicts.recordset.length > 0
            ? `⚠️ ${conflicts.recordset.length} existing allocations will overlap!`
            : null
    }
}


async function saveBulkAllocationRepo(req) {
    const db = req.tenantDB
    const {
        apply_to, // 'all' | 'department' | 'designation' | 'employment_type'
        department,
        designation,
        employment_type,
        valid_from,
        valid_to,
        note = null,
        allocations,             // [{ leave_type_id, allocated_days }]
        conflict_strategy = 'skip'  // 'skip' | 'replace' | 'preview_only'
    } = req.body

    let target_value = null
    if (apply_to === 'department') {
        target_value = department
    } else if (apply_to === 'designation') {
        target_value = designation
    } else if (apply_to === 'employment_type') {
        target_value = employment_type
    }

    if (!apply_to || !valid_from || !valid_to || !Array.isArray(allocations) || allocations.length === 0) {
        throw new Error("apply_to, valid_from, valid_to and allocations are required")
    }

    const transaction = new sql.Transaction(db)

    try {
        await transaction.begin()

        const empRequest = new sql.Request(transaction)
        let empQuery = `
            SELECT emp_code, employee_type_code
            FROM tbl_employee_mst
            WHERE is_active = 1
        `

        if (apply_to === 'department' && target_value) {
            empRequest.input("target", sql.NVarChar(100), target_value)
            empQuery += ` AND department_code = @target`
        } else if (apply_to === 'designation' && target_value) {
            empRequest.input("target", sql.NVarChar(100), target_value)
            empQuery += ` AND designation_code = @target`
        } else if (apply_to === 'employment_type' && target_value) {
            empRequest.input("target", sql.NVarChar(50), target_value)
            empQuery += ` AND employee_type_code = @target`
        }

        const empResult = await empRequest.query(empQuery)
        const targetEmployees = empResult.recordset

        if (targetEmployees.length === 0) {
            throw new Error("No employees match the selected criteria")
        }

        const leaveTypeIds = allocations.map(a => a.leave_type_id)
        const idList = leaveTypeIds.join(",")

        const conflictCheck = await new sql.Request(transaction)
            .input("valid_from", sql.Date, valid_from)
            .input("valid_to", sql.Date, valid_to)
            .query(`
                SELECT COUNT(1) AS cnt
                FROM tbl_leave_settings_allocation
                WHERE is_active = 1
                    AND leave_type_id IN (${idList})
                    AND valid_from <= @valid_to
                    AND valid_to >= @valid_from
                    AND emp_code IN ('${targetEmployees.map(e => e.emp_code).join("','")}')
            `)

        const hasConflicts = conflictCheck.recordset[0].cnt > 0

        if (conflict_strategy === 'preview_only') {
            await transaction.rollback()
            return {
                preview_mode: true,
                has_conflicts: hasConflicts,
                target_employees_count: targetEmployees.length,
                conflict_count: conflictCheck.recordset[0].cnt,
                message: hasConflicts
                    ? `Found ${conflictCheck.recordset[0].cnt} conflicting allocations. Please choose: skip, replace, or cancel.`
                    : 'No conflicts found. Safe to proceed.'
            }
        }

        if (hasConflicts && conflict_strategy === 'replace') {
            // Delete existing overlapping allocations
            await new sql.Request(transaction)
                .input("valid_from", sql.Date, valid_from)
                .input("valid_to", sql.Date, valid_to)
                .query(`
                    UPDATE tbl_leave_settings_allocation
                    SET is_active = 0, modified_date = GETDATE()
                    WHERE is_active = 1
                        AND leave_type_id IN (${idList})
                        AND valid_from <= @valid_to
                        AND valid_to >= @valid_from
                        AND emp_code IN ('${targetEmployees.map(e => e.emp_code).join("','")}')
                `)
            console.log('❌ Replaced existing conflicting allocations')
        }

        const applicabilityResult = await new sql.Request(transaction).query(`
            SELECT
                fv.LeaveTypeId,
                fv.FieldValue AS applicable_to
            FROM tbl_leave_type_field_values fv
            INNER JOIN tbl_leave_type_config cfg
                ON cfg.id = fv.ConfigFieldId
            WHERE cfg.FieldKey = 'applicableTo'
            AND fv.LeaveTypeId IN (${idList})
        `)

        const applicabilityMap = {}
        applicabilityResult.recordset.forEach(row => {
            applicabilityMap[row.LeaveTypeId] = row.applicable_to
                ? row.applicable_to.split(",").map(s => s.trim())
                : []
        })

        const batchResult = await new sql.Request(transaction)
            .input("apply_to", sql.VarChar(20), apply_to)
            .input("target_value", sql.NVarChar(100), target_value || null)
            .input("valid_from", sql.Date, valid_from)
            .input("valid_to", sql.Date, valid_to)
            .input("note", sql.NVarChar(500), note)
            .query(`
                INSERT INTO tbl_leave_setting_bulk_batch
                (apply_to, target_value, valid_from, valid_to, note, created_date)
                OUTPUT INSERTED.id
                VALUES
                (@apply_to, @target_value, @valid_from, @valid_to, @note, GETDATE())
            `)

        const batchId = batchResult.recordset[0].id

        let totalInserted = 0
        const skipped = []

        for (const emp of targetEmployees) {
            for (const leaf of allocations) {
                const { leave_type_id, allocated_days } = leaf

                const applicable = applicabilityMap[leave_type_id] || []
                if (applicable.length > 0 && !applicable.includes(emp.employee_type_code)) {
                    skipped.push({ emp_code: emp.emp_code, leave_type_id, reason: 'not_applicable' })
                    continue
                }

                const dupCheck = await new sql.Request(transaction)
                    .input("emp_code", sql.VarChar(20), emp.emp_code)
                    .input("leave_type_id", sql.Int, leave_type_id)
                    .input("valid_from", sql.Date, valid_from)
                    .input("valid_to", sql.Date, valid_to)
                    .query(`
                        SELECT COUNT(1) AS cnt
                        FROM tbl_leave_settings_allocation
                        WHERE emp_code      = @emp_code
                        AND   leave_type_id = @leave_type_id
                        AND   is_active     = 1
                        AND   valid_from   <= @valid_to
                        AND   valid_to     >= @valid_from
                    `)

                if (dupCheck.recordset[0].cnt > 0) {
                    skipped.push({ emp_code: emp.emp_code, leave_type_id, reason: conflict_strategy === 'skip' ? 'duplicate' : 'replaced' })
                    continue
                }

                await new sql.Request(transaction)
                    .input("emp_code", sql.VarChar(20), emp.emp_code)
                    .input("leave_type_id", sql.Int, leave_type_id)
                    .input("allocated_days", sql.Decimal(5, 1), parseFloat(allocated_days))
                    .input("valid_from", sql.Date, valid_from)
                    .input("valid_to", sql.Date, valid_to)
                    .input("bulk_batch_id", sql.Int, batchId)
                    .input("note", sql.NVarChar(500), note)
                    .query(`
                        INSERT INTO tbl_leave_settings_allocation
                        (
                            emp_code, leave_type_id, allocated_days,
                            valid_from, valid_to,
                            allocation_mode, bulk_batch_id, note,
                            is_active, created_date
                        )
                        VALUES
                        (
                            @emp_code, @leave_type_id, @allocated_days,
                            @valid_from, @valid_to,
                            'bulk', @bulk_batch_id, @note,
                            1, GETDATE()
                        )
                    `)

                totalInserted++
            }
        }

        await new sql.Request(transaction)
            .input("id", sql.Int, batchId)
            .input("total_employees", sql.Int, targetEmployees.length)
            .input("total_records", sql.Int, totalInserted)
            .query(`
                UPDATE tbl_leave_setting_bulk_batch
                SET total_employees = @total_employees,
                    total_records   = @total_records
                WHERE id = @id
            `)

        await transaction.commit()
        return {
            success: true,
            batch_id: batchId,
            total_employees: targetEmployees.length,
            total_inserted: totalInserted,
            skipped_count: skipped.length,
            skipped,
            conflict_strategy_used: conflict_strategy
        }

    } catch (err) {
        await transaction.rollback()
        throw err
    }
}

async function updateLeaveAllocationRepo(req) {
    const db = req.tenantDB
    const { id } = req.params
    const { allocated_days, valid_from, valid_to, note } = req.body

    const transaction = new sql.Transaction(db)

    try {
        await transaction.begin()

        const existCheck = await new sql.Request(transaction)
            .input("id", sql.Int, id)
            .query(`SELECT COUNT(1) AS cnt FROM tbl_leave_settings_allocation WHERE id = @id AND is_active = 1`)

        if (!existCheck.recordset[0].cnt) throw new Error("Allocation not found or inactive")

        await new sql.Request(transaction)
            .input("id", sql.Int, id)
            .input("allocated_days", sql.Decimal(5, 1), parseFloat(allocated_days))
            .input("valid_from", sql.Date, valid_from)
            .input("valid_to", sql.Date, valid_to)
            .input("note", sql.NVarChar(500), note || null)
            .query(`
                UPDATE tbl_leave_settings_allocation
                SET allocated_days = @allocated_days,
                    valid_from     = @valid_from,
                    valid_to       = @valid_to,
                    note           = @note,
                    modified_date  = GETDATE()
                WHERE id = @id
            `)

        await transaction.commit()
        return { success: true, id: parseInt(id) }

    } catch (err) {
        await transaction.rollback()
        throw err
    }
}

async function deleteLeaveAllocationRepo(req) {
    const db = req.tenantDB
    const { id } = req.params

    const transaction = new sql.Transaction(db)

    try {
        await transaction.begin()

        const request = new sql.Request(transaction)
        let query = `
            UPDATE tbl_leave_settings_allocation
            SET is_active = 0, modified_date = GETDATE()
            WHERE is_active = 1
        `

        if (isNaN(id)) {
            request.input("emp_code", sql.VarChar(20), id)
            query += ` AND emp_code = @emp_code`
        } else {
            request.input("id", sql.Int, parseInt(id))
            query += ` AND id = @id`
        }

        const result = await request.query(query)

        if (result.rowsAffected[0] === 0) {
            throw new Error("Allocation not found or already inactive")
        }

        await transaction.commit()
        return { success: true, id: isNaN(id) ? id : parseInt(id) }

    } catch (err) {
        await transaction.rollback()
        throw err
    }
}

module.exports = {
    getLeaveAllocationsRepo,
    getLeaveAllocationByIdRepo,
    saveSingleAllocationRepo,
    previewBulkConflictsRepo,
    saveBulkAllocationRepo,
    updateLeaveAllocationRepo,
    deleteLeaveAllocationRepo
}