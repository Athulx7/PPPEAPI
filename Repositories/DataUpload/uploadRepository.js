const sql = require('mssql')

async function getUploadMasters(req) {
    const db = req.tenantDB
    const result = await db.request().query(`
        SELECT 
            um.upload_id,
            um.upload_code,
            um.upload_name,
            COUNT(uf.field_id) AS total_fields,
            SUM(CASE WHEN uf.is_required = 1 AND uf.is_auto_code = 0 THEN 1 ELSE 0 END) AS mandatory_fields
        FROM tbl_upload_master um
        LEFT JOIN tbl_upload_fields uf 
            ON uf.upload_id = um.upload_id AND uf.is_active = 1
        WHERE um.is_active = 1
        GROUP BY um.upload_id, um.upload_code, um.upload_name
        ORDER BY um.upload_name
    `)
    return result.recordset
}

async function getUploadTemplateData(req, uploadCode) {
    const db = req.tenantDB

    const masterResult = await db.request()
        .input('uploadCode', sql.VarChar, uploadCode)
        .query(`SELECT * FROM tbl_upload_master WHERE upload_code = @uploadCode AND is_active = 1`)

    if (!masterResult.recordset.length) return { master: null, fields: [] }

    const master = masterResult.recordset[0]

    const fieldsResult = await db.request()
        .input('uploadId', sql.Int, master.upload_id)
        .query(`
            SELECT 
                uf.*,
                mf.code_prefix,
                mf.code_length
            FROM tbl_upload_fields uf
            LEFT JOIN tbl_master_fields mf ON mf.id = uf.master_field_id
            WHERE uf.upload_id = @uploadId AND uf.is_active = 1
            ORDER BY uf.priority
        `)

    return { master, fields: fieldsResult.recordset }
}

async function insertUploadBatch(req, { batchId, uploadId, fileName, fileSize, totalRecords }) {
    const db = req.tenantDB
    await db.request()
        .input('batchId', sql.VarChar, batchId)
        .input('uploadId', sql.Int, uploadId)
        .input('fileName', sql.NVarChar, fileName)
        .input('fileSize', sql.BigInt, fileSize)
        .input('totalRecords', sql.Int, totalRecords)
        .query(`
            INSERT INTO tbl_upload_batch
                (batch_id, upload_id, file_name, file_size, total_records, 
                 processed_records, success_records, error_records, status, progress)
            VALUES
                (@batchId, @uploadId, @fileName, @fileSize, @totalRecords,
                 0, 0, 0, 'processing', 0)
        `)
}

async function processUploadRows(req, { batchId, rows, fields, tableName }) {
    const db = req.tenantDB
    let success = 0
    let errorCount = 0

    const dropdownCache = {}
    for (const field of fields.filter(f => f.field_type === 'dropdown' && f.dropdown_source)) {
        try {
            const result = await db.request().query(field.dropdown_source)
            dropdownCache[field.column_name] = result.recordset.map(r =>
                String(r.value).toLowerCase().trim()
            )
        } catch (e) {
            dropdownCache[field.column_name] = []
        }
    }

    const autoCodeCounters = {}
    const autoCodeConfigs = {}

    for (const field of fields.filter(f => f.is_auto_code)) {
        const prefix = field.code_prefix || ''
        const codeLength = field.code_length || 3

        autoCodeConfigs[field.column_name] = { prefix, codeLength }

        try {
            const lastResult = await db.request().query(`
                SELECT TOP 1 ${field.column_name}
                FROM ${tableName}
                WHERE ${field.column_name} LIKE '${prefix}%'
                ORDER BY ${field.column_name} DESC
            `)

            if (lastResult.recordset.length) {
                const lastCode = lastResult.recordset[0][field.column_name]
                const numPart = lastCode.replace(prefix, '').trim()
                autoCodeCounters[field.column_name] = parseInt(numPart) || 0
            } else {
                autoCodeCounters[field.column_name] = 0
            }
        } catch (e) {
            autoCodeCounters[field.column_name] = 0
        }
    }

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowErrors = []
        const insertData = {}

        for (const field of fields) {

            if (field.is_auto_code) {
                const { prefix, codeLength } = autoCodeConfigs[field.column_name]
                autoCodeCounters[field.column_name] += 1
                insertData[field.column_name] = prefix + String(autoCodeCounters[field.column_name]).padStart(codeLength, '0')
                continue
            }

            if (field.is_hidden) {
                insertData[field.column_name] = field.default_value ?? 1
                continue
            }

            const headerKey = Object.keys(row).find(
                k => k.trim().replace(' *', '') === field.excel_header.trim().replace(' *', '')
            )
            const value = headerKey ? String(row[headerKey]).trim() : ''

            if (field.is_required && !value) {
                rowErrors.push({
                    column_name: field.column_name,
                    excel_header: field.excel_header,
                    provided_value: '',
                    error_type: 'required',
                    error_message: `${field.excel_header} is required`
                })
                continue
            }

            if (value && field.validation_regex) {
                const regex = new RegExp(field.validation_regex)
                if (!regex.test(value)) {
                    rowErrors.push({
                        column_name: field.column_name,
                        excel_header: field.excel_header,
                        provided_value: value,
                        error_type: 'invalid_format',
                        error_message: `${field.excel_header} has invalid format`
                    })
                    continue
                }
            }

            if (field.field_type === 'dropdown' && value) {
                const valid = dropdownCache[field.column_name] || []
                if (valid.length && !valid.includes(value.toLowerCase().trim())) {
                    rowErrors.push({
                        column_name: field.column_name,
                        excel_header: field.excel_header,
                        provided_value: value,
                        error_type: 'not_found',
                        error_message: `${field.excel_header}: "${value}" is not a valid option`
                    })
                    continue
                }
            }

            if (field.field_type === 'toggle') {
                insertData[field.column_name] = ['1', 'true', 'yes', 'active'].includes(
                    value.toLowerCase()
                ) ? 1 : 0
            } else {
                insertData[field.column_name] = value || null
            }
        }

        if (rowErrors.length > 0) {
            errorCount++

            for (const field of fields.filter(f => f.is_auto_code)) {
                autoCodeCounters[field.column_name] -= 1
            }

            for (const err of rowErrors) {
                await db.request()
                    .input('batchId', sql.VarChar, batchId)
                    .input('rowNumber', sql.Int, i + 2)
                    .input('columnName', sql.VarChar, err.column_name)
                    .input('excelHeader', sql.VarChar, err.excel_header)
                    .input('givenValue', sql.NVarChar, err.provided_value)
                    .input('errorType', sql.VarChar, err.error_type)
                    .input('errorMsg', sql.NVarChar, err.error_message)
                    .query(`
                        INSERT INTO tbl_upload_errors
                            (batch_id, row_number, column_name, excel_header,
                             provided_value, error_type, error_message)
                        VALUES
                            (@batchId, @rowNumber, @columnName, @excelHeader,
                             @givenValue, @errorType, @errorMsg)
                    `)
            }
            continue
        }

        try {
            const columns = Object.keys(insertData)
            const values = Object.values(insertData)
            const paramNames = columns.map((_, idx) => `@val${idx}`)

            const request = db.request()
            values.forEach((v, idx) => request.input(`val${idx}`, v))

            await request.query(`
                INSERT INTO ${tableName} (${columns.join(', ')})
                VALUES (${paramNames.join(', ')})
            `)
            success++

        } catch (dbErr) {
            errorCount++

            for (const field of fields.filter(f => f.is_auto_code)) {
                autoCodeCounters[field.column_name] -= 1
            }

            await db.request()
                .input('batchId', sql.VarChar, batchId)
                .input('rowNumber', sql.Int, i + 2)
                .input('errorMsg', sql.NVarChar, dbErr.message)
                .query(`
                    INSERT INTO tbl_upload_errors
                        (batch_id, row_number, column_name, excel_header, error_type, error_message)
                    VALUES
                        (@batchId, @rowNumber, 'DB_ERROR', 'Database', 'db_error', @errorMsg)
                `)
        }

        if (i % 10 === 0 || i === rows.length - 1) {
            const progress = Math.round(((i + 1) / rows.length) * 100)
            await db.request()
                .input('batchId', sql.VarChar, batchId)
                .input('proc', sql.Int, i + 1)
                .input('success', sql.Int, success)
                .input('errors', sql.Int, errorCount)
                .input('progress', sql.Int, progress)
                .query(`
                    UPDATE tbl_upload_batch SET
                        processed_records = @proc,
                        success_records   = @success,
                        error_records     = @errors,
                        progress          = @progress
                    WHERE batch_id = @batchId
                `)
        }
    }

    const finalStatus = errorCount === 0 ? 'completed'
        : success === 0 ? 'failed'
            : 'partial_success'

    await db.request()
        .input('batchId', sql.VarChar, batchId)
        .input('total', sql.Int, rows.length)
        .input('success', sql.Int, success)
        .input('errors', sql.Int, errorCount)
        .input('status', sql.VarChar, finalStatus)
        .query(`
            UPDATE tbl_upload_batch SET
                total_records     = @total,
                success_records   = @success,
                error_records     = @errors,
                processed_records = @total,
                status            = @status,
                progress          = 100,
                completed_at      = GETDATE()
            WHERE batch_id = @batchId
        `)

    return { success, errorCount, finalStatus }
}

async function getBatchStatus(req, batchId) {
    const db = req.tenantDB
    const result = await db.request()
        .input('batchId', sql.VarChar, batchId)
        .query(`
            SELECT 
                b.*,
                um.upload_name,
                um.upload_code
            FROM tbl_upload_batch b
            JOIN tbl_upload_master um ON um.upload_id = b.upload_id
            WHERE b.batch_id = @batchId
        `)
    return result.recordset[0] || null
}

async function getBatchErrors(req, batchId) {
    const db = req.tenantDB
    const result = await db.request()
        .input('batchId', sql.VarChar, batchId)
        .query(`
            SELECT * FROM tbl_upload_errors
            WHERE batch_id = @batchId
            ORDER BY row_number, error_id
        `)
    return result.recordset
}

async function getUploadHistory(req, filters) {
    const db = req.tenantDB
    const { uploadType, status, frmTime, toTime, search } = filters

    const conditions = []
    const request = db.request()

    if (uploadType && uploadType !== 'all') {
        conditions.push(`um.upload_code = @uploadType`)
        request.input('uploadType', sql.VarChar, uploadType)
    }
    if (status && status !== 'all') {
        conditions.push(`b.status = @status`)
        request.input('status', sql.VarChar, status)
    }
    if (frmTime) {
        conditions.push(`CAST(b.uploaded_at AS DATE) >= @frmTime`)
        request.input('frmTime', sql.Date, frmTime)
    }
    if (toTime) {
        conditions.push(`CAST(b.uploaded_at AS DATE) <= @toTime`)
        request.input('toTime', sql.Date, toTime)
    }
    if (search) {
        conditions.push(`(b.batch_id LIKE @search OR um.upload_name LIKE @search OR b.file_name LIKE @search)`)
        request.input('search', sql.NVarChar, `%${search}%`)
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await request.query(`
        SELECT 
            b.batch_id,
            b.file_name,
            b.file_size,
            b.total_records,
            b.success_records,
            b.error_records,
            b.processed_records,
            b.status,
            b.progress,
            b.uploaded_at,
            b.completed_at,
            um.upload_name,
            um.upload_code,
            -- Error count per batch
            (SELECT COUNT(*) FROM tbl_upload_errors e WHERE e.batch_id = b.batch_id) AS total_errors
        FROM tbl_upload_batch b
        JOIN tbl_upload_master um ON um.upload_id = b.upload_id
        ${whereClause}
        ORDER BY b.uploaded_at DESC
    `)

    return result.recordset
}

async function getUploadTypesForFilter(req) {
    const db = req.tenantDB
    const result = await db.request().query(`
        SELECT DISTINCT 
            um.upload_code AS value,
            um.upload_name AS label
        FROM tbl_upload_master um
        INNER JOIN tbl_upload_batch b ON b.upload_id = um.upload_id
        WHERE um.is_active = 1
        ORDER BY um.upload_name
    `)
    return result.recordset
}

async function getBatchRecords(req, batchId) {
    const db = req.tenantDB;

    const result = await db.request()
        .input('batchId', sql.VarChar, batchId)
        .query(`
            SELECT 
                r.record_id,
                r.row_number,
                r.raw_data,
                r.status,
                r.processed_at
            FROM tbl_upload_records r
            WHERE r.batch_id = @batchId
            ORDER BY r.row_number
        `);

    return result.recordset
}

module.exports = {
    getUploadMasters,
    getUploadTemplateData,
    insertUploadBatch,
    processUploadRows,
    getBatchStatus,
    getBatchErrors,
    getUploadHistory,
    getUploadTypesForFilter,
    getBatchRecords
}