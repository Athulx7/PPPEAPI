const ExcelJS = require('exceljs')
const XLSX = require('xlsx')
const multer = require('multer')
const { 
    getUploadMasters, 
    getUploadTemplateData, 
    insertUploadBatch, 
    processUploadRows,
    getBatchStatus,
    getBatchErrors,
    getUploadHistory,
    getUploadTypesForFilter,
    getBatchRecords
} = require('../../Repositories/DataUpload/uploadRepository')

// ✅ Multer config — memory only, no disk save
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv'
        ]
        allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only Excel/CSV files allowed'))
    }
})

// Export multer middleware so router can use it
const uploadMiddleware = upload.single('file')

async function getUploadMastersController(req, res) {
    try {
        const data = await getUploadMasters(req)
        return res.json({ success: true, data })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ success: false, message: "Failed to fetch upload masters" })
    }
}

async function downloadTemplateController(req, res) {
    try {
        const { uploadCode } = req.params
        const { master, fields } = await getUploadTemplateData(req, uploadCode)

        if (!master) return res.status(404).json({ success: false, message: "Invalid upload code" })

        const visibleFields = fields.filter(f => !f.is_hidden && !f.is_auto_code)

        if (!visibleFields.length) return res.status(400).json({ 
            success: false, message: "No fields configured" 
        })

        const workbook = new ExcelJS.Workbook()
        const worksheet = workbook.addWorksheet('Template')

        // Header row
        const headerRow = worksheet.addRow(
            visibleFields.map(f => f.excel_header + (f.is_required ? ' *' : ''))
        )

        headerRow.eachCell((cell, colNumber) => {
            const field = visibleFields[colNumber - 1]
            cell.font = { bold: true, color: { argb: field.is_required ? 'FFCC0000' : 'FF1F4E79' } }
            cell.fill = { type: 'pattern', pattern: 'solid', 
                          fgColor: { argb: field.is_required ? 'FFFFD7D7' : 'FFD6E4F0' } }
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
            cell.border = { bottom: { style: 'medium' } }
        })

        worksheet.columns = visibleFields.map(f => ({
            width: Math.max(f.excel_header.length + 8, 22)
        }))

        // Sample row
        const sampleRow = visibleFields.map(f =>
            f.field_type === 'toggle'   ? '1' :
            f.field_type === 'dropdown' ? 'see valid values' :
            `sample ${f.excel_header.toLowerCase()}`
        )
        const sample = worksheet.addRow(sampleRow)
        sample.font = { italic: true, color: { argb: 'FF999999' } }

        res.setHeader('Content-Disposition', `attachment; filename=${uploadCode}_template.xlsx`)
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

        await workbook.xlsx.write(res)
        res.end()

    } catch (err) {
        console.error(err)
        return res.status(500).json({ success: false, message: "Failed to download template" })
    }
}

async function uploadFileController(req, res) {
    try {
        const file = req.file
        const { uploadCode } = req.body

        if (!file) return res.status(400).json({ success: false, message: "No file uploaded" })
        if (!uploadCode) return res.status(400).json({ success: false, message: "uploadCode is required" })

        const { master, fields } = await getUploadTemplateData(req, uploadCode)
        if (!master) return res.status(400).json({ success: false, message: "Invalid upload master" })

        // Parse Excel from buffer (NOT saved to disk)
        const workbook = XLSX.read(file.buffer, { type: 'buffer' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        if (!rows.length) return res.status(400).json({ success: false, message: "File is empty" })

        const batchId = `BATCH-${Date.now()}`

        await insertUploadBatch(req, {
            batchId,
            uploadId: master.upload_id,
            fileName: file.originalname,
            fileSize: file.size
        })

        // ✅ Respond immediately with batchId
        res.json({ success: true, message: "Upload started", data: { batch_id: batchId, total_records: rows.length } })

        // ✅ Process in background (non-blocking)
        processUploadRows(req, { batchId, rows, fields, tableName: master.table_name })
            .catch(err => console.error('Background processing error:', err))

    } catch (err) {
        console.error(err)
        return res.status(500).json({ success: false, message: "Upload failed" })
    }
}

async function getBatchStatusController(req, res) {
    try {
        const { batchId } = req.params
        const data = await getBatchStatus(req, batchId)
        if (!data) return res.status(404).json({ success: false, message: "Batch not found" })
        return res.json({ success: true, data })
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch batch status" })
    }
}

async function getBatchErrorsController(req, res) {
    try {
        const { batchId } = req.params
        const data = await getBatchErrors(req, batchId)
        return res.json({ success: true, data })
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch errors" })
    }
}
async function getUploadHistoryController(req, res) {
    try {
        const filters = {
            uploadType: req.query.uploadType || '',
            status:     req.query.status     || '',
            frmTime:    req.query.frmTime    || '',
            toTime:     req.query.toTime     || '',
            search:     req.query.search     || ''
        }
        const data = await getUploadHistory(req, filters)
        return res.json({ success: true, data })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ success: false, message: 'Failed to fetch upload history' })
    }
}

// ✅ Upload type options for history filter dropdown
async function getUploadTypesController(req, res) {
    try {
        const data = await getUploadTypesForFilter(req)
        return res.json({ success: true, data })
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch upload types' })
    }
}

async function getBatchRecordsController(req, res) {
    try {
        const { batchId } = req.params;

        const data = await getBatchRecords(req, batchId);

        return res.json({
            success: true,
            data
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch records"
        });
    }
}

module.exports = {
    getUploadMastersController,
    downloadTemplateController,
    uploadFileController,
    getBatchStatusController,
    getBatchErrorsController,
    getUploadHistoryController,   // ✅
    getUploadTypesController,     // ✅
    getBatchRecordsController,
    uploadMiddleware
}