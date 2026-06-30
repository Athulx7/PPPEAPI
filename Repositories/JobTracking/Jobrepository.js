const sql = require("mssql")

const getJobTypes = async (pool) => {
    const result = await pool.request().query(`
        SELECT job_type_id, type_name, prefix_code
        FROM tbl_job_type
        WHERE is_active = 1
        ORDER BY type_name
    `)
    return result.recordset
}

const getJobStatuses = async (pool) => {
    const result = await pool.request().query(`
        SELECT id, status_code, status_name, color_code, sequence_order, is_final
        FROM tbl_job_status
        WHERE is_active = 1
        ORDER BY sequence_order
    `)
    return result.recordset
}

const getJobPriorities = async (pool) => {
    const result = await pool.request().query(`
        SELECT priority_id, jprority_code, priority_name, color_code, level
        FROM tbl_job_priority
        WHERE is_active = 1
        ORDER BY level
    `)
    return result.recordset
}

const getDepartments = async (pool) => {
    const result = await pool.request().query(`
        SELECT depart_code, depart_name
        FROM tbl_department_mst
        WHERE is_active = 1
        ORDER BY depart_name
    `)
    return result.recordset
}

const getDesignations = async (pool, departCode) => {
    const request = pool.request()
    let query = ` SELECT desig_code, desig_name, depart_code
        FROM tbl_designation_mst
        WHERE is_active = 1
    `
    if (departCode) {
        query += ` AND depart_code = @departCode`
        request.input("departCode", sql.VarChar(20), departCode)
    }
    query += ` ORDER BY desig_name`
    const result = await request.query(query)
    return result.recordset
}

const getEmployeesByDepartment = async (pool, departCode) => {
    const request = pool.request()
    let query = ` SELECT emp_code, CONCAT(first_name, ' ', ISNULL(last_name, '')) AS emp_name, department_code, designation_code
        FROM tbl_employee_mst
        WHERE is_active = 1
    `
    if (departCode) {
        query += ` AND department_code = @departCode`
        request.input("departCode", sql.VarChar(20), departCode)
    }
    query += ` ORDER BY emp_name`
    const result = await request.query(query)
    return result.recordset
}

const getCustomFieldDefinitions = async (pool, jobTypeId) => {
    const result = await pool.request()
        .input("jobTypeId", sql.Int, jobTypeId)
        .query(` SELECT field_id, job_type_id, field_key, field_label, field_type,
                   field_options, is_required, sequence_order
            FROM tbl_job_custom_field_definition
            WHERE is_active = 1
              AND (job_type_id = @jobTypeId OR job_type_id IS NULL)
            ORDER BY sequence_order
        `)

    return result.recordset.map((f) => ({
        ...f,
        field_options: f.field_options ? JSON.parse(f.field_options) : null,
    }))
}

const saveCustomFieldValues = async (transactionRequest, jobId, customValues) => {
    if (!customValues || customValues.length === 0) return

    for (const cv of customValues) {
        await transactionRequest
            .input(`jobId_${cv.field_id}`, sql.BigInt, jobId)
            .input(`fieldId_${cv.field_id}`, sql.Int, cv.field_id)
            .input(`fieldValue_${cv.field_id}`, sql.NVarChar(sql.MAX), cv.field_value ?? null)
            .query(`
                MERGE tbl_job_custom_field_value AS target
                USING (SELECT @jobId_${cv.field_id} AS job_id, @fieldId_${cv.field_id} AS field_id) AS src
                ON target.job_id = src.job_id AND target.field_id = src.field_id
                WHEN MATCHED THEN
                    UPDATE SET field_value = @fieldValue_${cv.field_id}
                WHEN NOT MATCHED THEN
                    INSERT (job_id, field_id, field_value)
                    VALUES (src.job_id, src.field_id, @fieldValue_${cv.field_id});
            `)
    }
}

const getCustomFieldValuesByJob = async (pool, jobId) => {
    const result = await pool
        .request()
        .input("jobId", sql.BigInt, jobId)
        .query(`  SELECT v.field_id, d.field_key, d.field_label, d.field_type, v.field_value
            FROM tbl_job_custom_field_value v
            INNER JOIN tbl_job_custom_field_definition d ON d.field_id = v.field_id
            WHERE v.job_id = @jobId
            ORDER BY d.sequence_order
        `)
    return result.recordset
}

const generateJobCode = async (transaction, jobTypeId) => {
    const currentYear = new Date().getFullYear()

    const updateResult = await new sql.Request(transaction)
        .input("jobTypeId", sql.Int, jobTypeId)
        .input("yearValue", sql.Int, currentYear)
        .query(`  UPDATE tbl_job_id_sequence
            SET current_number = current_number + 1
            OUTPUT INSERTED.current_number, INSERTED.format_pattern
            WHERE job_type_id = @jobTypeId AND year_value = @yearValue;
        `)

    let row = updateResult.recordset[0]

    if (!row) {
        const insertResult = await new sql.Request(transaction)
            .input("jobTypeId2", sql.Int, jobTypeId)
            .input("yearValue2", sql.Int, currentYear)
            .query(`
                INSERT INTO tbl_job_id_sequence (job_type_id, year_value, current_number, format_pattern)
                OUTPUT INSERTED.current_number, INSERTED.format_pattern
                VALUES (@jobTypeId2, @yearValue2, 1, '{PREFIX}-{YYYY}-{SEQ4}')
            `)
        row = insertResult.recordset[0]
    }

    const prefixResult = await new sql.Request(transaction)
        .input("jobTypeId3", sql.Int, jobTypeId)
        .query(` SELECT prefix_code
            FROM tbl_job_type
            WHERE job_type_id = @jobTypeId3
        `)

    const prefixCode = prefixResult.recordset[0]?.prefix_code || ""
    const seq4 = String(row.current_number).padStart(4, "0")
    const jobCode = (row.format_pattern || "{PREFIX}-{YYYY}-{SEQ4}")
        .replace("{PREFIX}", prefixCode)
        .replace("{YYYY}", currentYear)
        .replace("{SEQ4}", seq4)

    return jobCode
}

const createJob = async (pool, data) => {
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const jobCode = await generateJobCode(transaction, data.job_type_id)

        let statusId = data.status_id
        if (!statusId) {
            const statusResult = await new sql.Request(transaction).query(`
                SELECT TOP 1 id FROM tbl_job_status
                WHERE is_active = 1 AND is_final = 0
                ORDER BY sequence_order
            `)
            statusId = statusResult.recordset[0]?.id
        }

        const insertRequest = new sql.Request(transaction)
        const insertResult = await insertRequest
            .input("jobCode", sql.NVarChar(30), jobCode)
            .input("parentJobId", sql.BigInt, data.parent_job_id || null)
            .input("jobTypeId", sql.Int, data.job_type_id)
            .input("title", sql.NVarChar(200), data.title)
            .input("description", sql.NVarChar(sql.MAX), data.description || null)
            .input("statusId", sql.Int, statusId)
            .input("priorityId", sql.Int, data.priority_id)
            .input("createdByEmpCode", sql.VarChar(20), data.created_by_emp_code)
            .input("assignedToEmpCode", sql.VarChar(20), data.assigned_to_emp_code || null)
            .input("assignedDepartmentCode", sql.VarChar(20), data.assigned_department_code || null)
            .input("assignedDesignationCode", sql.VarChar(20), data.assigned_designation_code || null)
            .input("dueDate", sql.DateTime, data.due_date || null)
            .query(`
                INSERT INTO tbl_job (
                    job_code, parent_job_id, job_type_id, title, description,
                    status_id, priority_id, created_by_emp_code, assigned_to_emp_code,
                    assigned_department_code, assigned_designation_code, due_date
                )
                OUTPUT INSERTED.job_id, INSERTED.job_code
                VALUES (
                    @jobCode, @parentJobId, @jobTypeId, @title, @description,
                    @statusId, @priorityId, @createdByEmpCode, @assignedToEmpCode,
                    @assignedDepartmentCode, @assignedDesignationCode, @dueDate
                )
            `)

        const { job_id: jobId, job_code: createdJobCode } = insertResult.recordset[0]

        if (data.custom_values && data.custom_values.length > 0) {
            const cfRequest = new sql.Request(transaction);
            await saveCustomFieldValues(cfRequest, jobId, data.custom_values)
        }

        await new sql.Request(transaction)
            .input("jobId", sql.BigInt, jobId)
            .input("newStatusId", sql.Int, statusId)
            .input("changedByEmpCode", sql.VarChar(20), data.created_by_emp_code)
            .query(`
                INSERT INTO tbl_job_status_history (job_id, old_status_id, new_status_id, changed_by_emp_code, remarks)
                VALUES (@jobId, NULL, @newStatusId, @changedByEmpCode, 'Job created')
            `)

        if (data.assigned_to_emp_code || data.assigned_department_code) {
            await new sql.Request(transaction)
                .input("jobId", sql.BigInt, jobId)
                .input("toEmpCode", sql.VarChar(20), data.assigned_to_emp_code || null)
                .input("toDepartmentCode", sql.VarChar(20), data.assigned_department_code || null)
                .input("toDesignationCode", sql.VarChar(20), data.assigned_designation_code || null)
                .input("actionByEmpCode", sql.VarChar(20), data.created_by_emp_code)
                .query(`
                    INSERT INTO tbl_job_assignment_history (
                        job_id, action_type, to_emp_code, to_department_code, to_designation_code, action_by_emp_code, remarks
                    )
                    VALUES (@jobId, 'ASSIGNED', @toEmpCode, @toDepartmentCode, @toDesignationCode, @actionByEmpCode, 'Assigned at creation');
                `)
        }

        await transaction.commit()
        return { job_id: jobId, job_code: createdJobCode }
    } catch (err) {
        console.error("createJob database error:", err)
        await transaction.rollback()
        throw err
    }
}

const getJobList = async (pool, filters = {}) => {
    const {
        status_id,
        priority_id,
        job_type_id,
        assigned_to_emp_code,
        assigned_department_code,
        parent_job_id,
        search,
        page = 1,
        pageSize = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        user_scope_emp_code,
    } = filters

    const request = pool.request()
    const conditions = ["j.is_active = 1"]

    if (status_id) {
        conditions.push("j.status_id = @statusId")
        request.input("statusId", sql.Int, status_id)
    }
    if (priority_id) {
        conditions.push("j.priority_id = @priorityId")
        request.input("priorityId", sql.Int, priority_id)
    }
    if (job_type_id) {
        conditions.push("j.job_type_id = @jobTypeId")
        request.input("jobTypeId", sql.Int, job_type_id)
    }
    if (assigned_to_emp_code) {
        if (assigned_to_emp_code === 'null') {
            conditions.push("j.assigned_to_emp_code IS NULL AND j.assigned_department_code IS NULL")
        } else {
            conditions.push("j.assigned_to_emp_code = @assignedToEmpCode")
            request.input("assignedToEmpCode", sql.VarChar(20), assigned_to_emp_code)
        }
    }
    if (assigned_department_code) {
        conditions.push("j.assigned_department_code = @assignedDepartmentCode")
        request.input("assignedDepartmentCode", sql.VarChar(20), assigned_department_code)
    }
    if (user_scope_emp_code) {
        conditions.push(`(
            j.created_by_emp_code = @userScopeEmpCode OR 
            j.assigned_to_emp_code = @userScopeEmpCode OR 
            (SELECT TOP 1 emp_code FROM tbl_job_time_log tl WHERE tl.job_id = j.job_id AND tl.end_time IS NULL ORDER BY tl.start_time DESC) = @userScopeEmpCode
        )`)
        request.input("userScopeEmpCode", sql.VarChar(20), user_scope_emp_code)
    }
    if (parent_job_id !== undefined) {
        if (parent_job_id === null || parent_job_id === "null") {
            conditions.push("j.parent_job_id IS NULL")
        } else {
            conditions.push("j.parent_job_id = @parentJobId")
            request.input("parentJobId", sql.BigInt, parent_job_id)
        }
    }
    if (search) {
        conditions.push("(j.title LIKE @search OR j.job_code LIKE @search)")
        request.input("search", sql.NVarChar(100), `%${search}%`)
    }

    const whereClause = conditions.join(" AND ")
    const offset = (page - 1) * pageSize

    request.input("offset", sql.Int, offset)
    request.input("pageSize", sql.Int, pageSize)

    const result = await request.query(`
        SELECT
            j.job_id, j.job_code, j.parent_job_id, j.title,
            jt.type_name, jt.prefix_code,
            js.status_code, js.status_name, js.color_code AS status_color,
            jp.priority_name, jp.color_code AS priority_color, jp.level AS priority_level,
            j.assigned_to_emp_code, j.assigned_department_code, j.assigned_designation_code,
            j.due_date, j.start_date, j.completed_date, j.created_date, j.created_by_emp_code,
            (SELECT COUNT(*) FROM tbl_job sub WHERE sub.parent_job_id = j.job_id AND sub.is_active = 1) AS sub_job_count,
            (SELECT TOP 1 emp_code FROM tbl_job_time_log tl WHERE tl.job_id = j.job_id AND tl.end_time IS NULL ORDER BY tl.start_time DESC) AS running_emp_code,
            COUNT(*) OVER() AS total_count
        FROM tbl_job j
        INNER JOIN tbl_job_type jt ON jt.job_type_id = j.job_type_id
        INNER JOIN tbl_job_status js ON js.id = j.status_id
        INNER JOIN tbl_job_priority jp ON jp.priority_id = j.priority_id
        WHERE ${whereClause}
        ORDER BY j.created_date DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `)

    const totalCount = result.recordset.length > 0 ? result.recordset[0].total_count : 0

    return {
        data: result.recordset,
        totalCount,
        page,
        pageSize,
    }
}

const getJobById = async (pool, jobId) => {
    const result = await pool
        .request()
        .input("jobId", sql.BigInt, jobId)
        .query(`
            SELECT
                j.*, jt.type_name, jt.prefix_code,
                js.status_code, js.status_name, js.color_code AS status_color,
                jp.priority_name, jp.color_code AS priority_color
            FROM tbl_job j
            INNER JOIN tbl_job_type jt ON jt.job_type_id = j.job_type_id
            INNER JOIN tbl_job_status js ON js.id = j.status_id
            INNER JOIN tbl_job_priority jp ON jp.priority_id = j.priority_id
            WHERE j.job_id = @jobId;
        `)
    return result.recordset[0] || null
}

const startTimer = async (pool, jobId, empCode, runningStatusId) => {
    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    try {
        const request = new sql.Request(transaction)

        await request
            .input("jobId1", sql.BigInt, jobId)
            .input("empCode1", sql.VarChar(20), empCode)
            .query(`
                UPDATE tbl_job_time_log
                SET end_time = GETDATE()
                WHERE job_id = @jobId1 AND emp_code = @empCode1 AND end_time IS NULL
            `)

        const insertResult = await new sql.Request(transaction)
            .input("jobId2", sql.BigInt, jobId)
            .input("empCode2", sql.VarChar(20), empCode)
            .query(`
                INSERT INTO tbl_job_time_log (job_id, emp_code, start_time, log_type)
                OUTPUT INSERTED.time_log_id, INSERTED.start_time
                VALUES (@jobId2, @empCode2, GETDATE(), 'RUN')
            `)

        await new sql.Request(transaction)
            .input("jobId3", sql.BigInt, jobId)
            .query(`
                UPDATE tbl_job
                SET start_date = ISNULL(start_date, GETDATE()), updated_date = GETDATE()
                WHERE job_id = @jobId3
            `)

        if (runningStatusId) {
            await new sql.Request(transaction)
                .input("jobId4", sql.BigInt, jobId)
                .input("statusId4", sql.Int, runningStatusId)
                .query(`
                    UPDATE tbl_job SET status_id = @statusId4, updated_date = GETDATE()
                    WHERE job_id = @jobId4
                `)
        }

        await transaction.commit()
        return insertResult.recordset[0]
    } catch (err) {
        await transaction.rollback()
        throw err
    }
}

const stopTimer = async (pool, jobId, data) => {
    const { emp_code, log_type, remarks, new_status_id, refer_to_emp_code, refer_to_department_code, refer_to_designation_code } = data

    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    try {
        const closeResult = await new sql.Request(transaction)
            .input("jobId1", sql.BigInt, jobId)
            .input("empCode1", sql.VarChar(20), emp_code)
            .input("remarks1", sql.NVarChar(300), remarks || null)
            .query(`
                UPDATE tbl_job_time_log
                SET end_time = GETDATE(), remarks = @remarks1
                OUTPUT INSERTED.time_log_id, INSERTED.start_time, INSERTED.end_time
                WHERE time_log_id = (
                    SELECT TOP 1 time_log_id FROM tbl_job_time_log
                    WHERE job_id = @jobId1 AND emp_code = @empCode1 AND end_time IS NULL
                    ORDER BY start_time DESC
                )
            `)

        if (new_status_id) {
            const statusResult = await new sql.Request(transaction)
                .input("jobId2", sql.BigInt, jobId)
                .query(`SELECT status_id FROM tbl_job WHERE job_id = @jobId2`)
            const oldStatusId = statusResult.recordset[0]?.status_id || null

            await new sql.Request(transaction)
                .input("jobId3", sql.BigInt, jobId)
                .input("statusId3", sql.Int, new_status_id)
                .query(`
                    UPDATE tbl_job SET status_id = @statusId3, updated_date = GETDATE()
                    WHERE job_id = @jobId3
                `)

            await new sql.Request(transaction)
                .input("jobId4", sql.BigInt, jobId)
                .input("oldStatusId4", sql.Int, oldStatusId)
                .input("newStatusId4", sql.Int, new_status_id)
                .input("changedBy4", sql.VarChar(20), emp_code)
                .input("remarks4", sql.NVarChar(500), remarks || null)
                .query(`
                    INSERT INTO tbl_job_status_history (job_id, old_status_id, new_status_id, changed_by_emp_code, remarks)
                    VALUES (@jobId4, @oldStatusId4, @newStatusId4, @changedBy4, @remarks4)
                `)
        }

        if (refer_to_emp_code || refer_to_department_code) {
            await new sql.Request(transaction)
                .input("jobId5", sql.BigInt, jobId)
                .input("toEmpCode5", sql.VarChar(20), refer_to_emp_code || null)
                .input("toDeptCode5", sql.VarChar(20), refer_to_department_code || null)
                .input("toDesigCode5", sql.VarChar(20), refer_to_designation_code || null)
                .input("actionBy5", sql.VarChar(20), emp_code)
                .input("remarks5", sql.NVarChar(500), remarks || null)
                .query(`
                    INSERT INTO tbl_job_assignment_history (
                        job_id, action_type, to_emp_code, to_department_code, to_designation_code, action_by_emp_code, remarks
                    )
                    VALUES (@jobId5, 'REFERRED', @toEmpCode5, @toDeptCode5, @toDesigCode5, @actionBy5, @remarks5)
                `)

            await new sql.Request(transaction)
                .input("jobId6", sql.BigInt, jobId)
                .input("toEmpCode6", sql.VarChar(20), refer_to_emp_code || null)
                .input("toDeptCode6", sql.VarChar(20), refer_to_department_code || null)
                .input("toDesigCode6", sql.VarChar(20), refer_to_designation_code || null)
                .query(`
                    UPDATE tbl_job
                    SET assigned_to_emp_code = @toEmpCode6,
                        assigned_department_code = ISNULL(@toDeptCode6, assigned_department_code),
                        assigned_designation_code = @toDesigCode6,
                        updated_date = GETDATE()
                    WHERE job_id = @jobId6
                `)
        }

        await transaction.commit()
        return closeResult.recordset[0] || null
    } catch (err) {
        await transaction.rollback()
        throw err
    }
}

const getJobTimeSummary = async (pool, jobId) => {
    const result = await pool
        .request()
        .input("jobId", sql.BigInt, jobId)
        .query(`
            SELECT
                ISNULL(SUM(duration_minutes), 0) AS total_minutes,
                (SELECT TOP 1 emp_code FROM tbl_job_time_log WHERE job_id = @jobId AND end_time IS NULL) AS running_emp_code,
                (SELECT TOP 1 start_time FROM tbl_job_time_log WHERE job_id = @jobId AND end_time IS NULL) AS running_start_time
            FROM tbl_job_time_log
            WHERE job_id = @jobId AND end_time IS NOT NULL
        `)
    return result.recordset[0]
}

const getJobTimeLogs = async (pool, jobId) => {
    const result = await pool
        .request()
        .input("jobId", sql.BigInt, jobId)
        .query(`
            SELECT time_log_id, emp_code, start_time, end_time, duration_minutes, log_type, remarks
            FROM tbl_job_time_log
            WHERE job_id = @jobId
            ORDER BY start_time DESC
        `)
    return result.recordset
}

const assignOrReferJob = async (pool, jobId, data) => {
    const { action_type, to_emp_code, to_department_code, to_designation_code, remarks, action_by_emp_code } = data

    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    try {
        const current = await new sql.Request(transaction)
            .input("jobId1", sql.BigInt, jobId)
            .query(`
                SELECT assigned_to_emp_code, assigned_department_code, assigned_designation_code
                FROM tbl_job WHERE job_id = @jobId1
            `)
        const fromState = current.recordset[0] || {}

        await new sql.Request(transaction)
            .input("jobId2", sql.BigInt, jobId)
            .input("actionType2", sql.NVarChar(20), action_type || "REFERRED")
            .input("fromEmp2", sql.VarChar(20), fromState.assigned_to_emp_code || null)
            .input("toEmp2", sql.VarChar(20), to_emp_code || null)
            .input("fromDept2", sql.VarChar(20), fromState.assigned_department_code || null)
            .input("toDept2", sql.VarChar(20), to_department_code || null)
            .input("fromDesig2", sql.VarChar(20), fromState.assigned_designation_code || null)
            .input("toDesig2", sql.VarChar(20), to_designation_code || null)
            .input("remarks2", sql.NVarChar(500), remarks || null)
            .input("actionBy2", sql.VarChar(20), action_by_emp_code)
            .query(`
                INSERT INTO tbl_job_assignment_history (
                    job_id, action_type, from_emp_code, to_emp_code,
                    from_department_code, to_department_code,
                    from_designation_code, to_designation_code,
                    remarks, action_by_emp_code
                )
                VALUES (
                    @jobId2, @actionType2, @fromEmp2, @toEmp2,
                    @fromDept2, @toDept2, @fromDesig2, @toDesig2,
                    @remarks2, @actionBy2
                )
            `)

        await new sql.Request(transaction)
            .input("jobId3", sql.BigInt, jobId)
            .input("toEmp3", sql.VarChar(20), to_emp_code || null)
            .input("toDept3", sql.VarChar(20), to_department_code || null)
            .input("toDesig3", sql.VarChar(20), to_designation_code || null)
            .query(`
                UPDATE tbl_job
                SET assigned_to_emp_code = @toEmp3,
                    assigned_department_code = ISNULL(@toDept3, assigned_department_code),
                    assigned_designation_code = @toDesig3,
                    updated_date = GETDATE()
                WHERE job_id = @jobId3
            `)

        await transaction.commit()
        return { success: true }
    } catch (err) {
        await transaction.rollback()
        throw err
    }
}

const getAssignmentHistory = async (pool, jobId) => {
    const result = await pool
        .request()
        .input("jobId", sql.BigInt, jobId)
        .query(`
            SELECT assignment_id, action_type, from_emp_code, to_emp_code,
                   from_department_code, to_department_code,
                   from_designation_code, to_designation_code,
                   remarks, action_date, action_by_emp_code
            FROM tbl_job_assignment_history
            WHERE job_id = @jobId
            ORDER BY action_date DESC;
        `);
    return result.recordset
}

const getStatusHistory = async (pool, jobId) => {
    const result = await pool
        .request()
        .input("jobId", sql.BigInt, jobId)
        .query(`
            SELECT h.history_id, h.old_status_id, os.status_name AS old_status_name,
                   h.new_status_id, ns.status_name AS new_status_name,
                   h.changed_by_emp_code, h.remarks, h.changed_date
            FROM tbl_job_status_history h
            LEFT JOIN tbl_job_status os ON os.id = h.old_status_id
            INNER JOIN tbl_job_status ns ON ns.id = h.new_status_id
            WHERE h.job_id = @jobId
            ORDER BY h.changed_date DESC;
        `)
    return result.recordset
}

module.exports = {
    getJobTypes,
    getJobStatuses,
    getJobPriorities,
    getDepartments,
    getDesignations,
    getEmployeesByDepartment,
    getCustomFieldDefinitions,
    getCustomFieldValuesByJob,
    saveCustomFieldValues,
    generateJobCode,
    createJob,
    getJobList,
    getJobById,
    startTimer,
    stopTimer,
    getJobTimeSummary,
    getJobTimeLogs,
    assignOrReferJob,
    getAssignmentHistory,
    getStatusHistory,
}