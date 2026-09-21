const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sql, connectToDb } = require('../DB/db_Connection');

async function createTemplateDatabase() {
    await connectToDb();

    console.log('--- Starting Template Database Generation ---');

    // 1. Determine SQL Server default data and backup paths
    const pathRes = await sql.query(`
        SELECT 
            SERVERPROPERTY('InstanceDefaultDataPath') as data_path,
            SERVERPROPERTY('InstanceDefaultBackupPath') as backup_path
    `);
    const dataPath = pathRes.recordset[0].data_path;
    const backupPath = pathRes.recordset[0].backup_path || dataPath;

    const tempBakFile = path.join(backupPath, 'PPPA_temp_for_template.bak');
    const masterBakFile = path.join(backupPath, 'PPP_TemplateDB.bak');

    // Local copy directory inside project for portability
    const localBackupDir = path.join(__dirname, '../DB/backup');
    if (!fs.existsSync(localBackupDir)) {
        fs.mkdirSync(localBackupDir, { recursive: true });
    }
    const localBakCopy = path.join(localBackupDir, 'PPP_TemplateDB.bak');

    console.log(`1. Taking COPY_ONLY backup of PPPA...`);
    await sql.query(`
        BACKUP DATABASE [PPPA] 
        TO DISK = '${tempBakFile.replace(/'/g, "''")}' 
        WITH COPY_ONLY, INIT, FORMAT
    `);
    console.log(`✅ Reference backup completed: ${tempBakFile}`);

    console.log(`2. Restoring to [PPP_TemplateDB]...`);
    // Ensure any open connections to PPP_TemplateDB are dropped
    await sql.query(`
        IF EXISTS (SELECT name FROM sys.databases WHERE name = 'PPP_TemplateDB')
        BEGIN
            ALTER DATABASE [PPP_TemplateDB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
            DROP DATABASE [PPP_TemplateDB];
        END
    `);

    const templateMdf = path.join(dataPath, 'PPP_TemplateDB.mdf');
    const templateLdf = path.join(dataPath, 'PPP_TemplateDB_log.ldf');

    await sql.query(`
        RESTORE DATABASE [PPP_TemplateDB]
        FROM DISK = '${tempBakFile.replace(/'/g, "''")}'
        WITH 
            MOVE 'PPPA' TO '${templateMdf.replace(/'/g, "''")}',
            MOVE 'PPPA_log' TO '${templateLdf.replace(/'/g, "''")}',
            REPLACE
    `);
    console.log(`✅ Restored [PPP_TemplateDB].`);

    // 3. Clean database: Retain ONLY approved seed tables, EMPTY leave_type, EMPTY salary_components, EMPTY transactional data
    console.log(`3. Cleaning tables in [PPP_TemplateDB]...`);
    const cleanSql = `
        USE [PPP_TemplateDB];

        -- Temporarily disable all foreign key constraints
        EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT ALL";

        -- A. MANDATORY EMPTY TABLES AS SPECIFIED BY USER:
        DELETE FROM [tbl_leave_type_field_values];
        DELETE FROM [tbl_leave_request_document];
        DELETE FROM [tbl_leave_request];
        DELETE FROM [tbl_leave_setting_bulk_batch];
        DELETE FROM [tbl_leave_settings_allocation];
        DELETE FROM [tbl_leave_type_config];
        DELETE FROM [tbl_leave_category];
        DELETE FROM [tbl_leave_accrual_types];
        DELETE FROM [tbl_leave_type]; -- MUST BE EMPTY

        DELETE FROM [tbl_salary_structure_history];
        DELETE FROM [tbl_salary_structure_assignment];
        DELETE FROM [tbl_salary_structure_components];
        DELETE FROM [tbl_salary_structure];
        DELETE FROM [tbl_salary_advance_request];
        DELETE FROM [tbl_salary_components]; -- MUST BE EMPTY
        DELETE FROM [tbl_salary_component_type]; -- USER REQUIREMENT: Dynamic table, must be empty
        DELETE FROM [tbl_slry_comp_calculation_type]; -- USER REQUIREMENT: Dynamic table, must be empty (NO default components)

        -- B. EMPTY ALL EMPLOYEE & TRANSACTIONAL TABLES:
        DELETE FROM [tbl_attendance_punch_mode_mst];
        DELETE FROM [tbl_attendance_raw_punch_log];
        DELETE FROM [tbl_attendance_regularization];
        DELETE FROM [tbl_attendance];
        DELETE FROM [tbl_biometric_device_mst];
        DELETE FROM [tbl_biometric_punch_raw];
        DELETE FROM [tbl_company_attendance_config];
        DELETE FROM [tbl_company_branches];
        DELETE FROM [tbl_company_punch_mode_map];
        DELETE FROM [tbl_company_settings];
        DELETE FROM [tbl_employee_biometric_mapping];
        DELETE FROM [tbl_employee_lunch_break];
        DELETE FROM [tbl_employee_menus];
        DELETE FROM [tbl_designation_menus];
        DELETE FROM [tbl_menu_favourites];
        DELETE FROM [tbl_user_info];
        DELETE FROM [tbl_employee_mst];

        DELETE FROM [tbl_payroll_employee_work_schedules];
        DELETE FROM [tbl_payroll_run];
        DELETE FROM [tbl_payslip];
        DELETE FROM [tbl_payroll_work_schedule_config];
        DELETE FROM [tbl_payrollsettings_general];
        DELETE FROM [tbl_payrollsettings_module_config];
        DELETE FROM [tbl_payrollsettings_regularization];
        DELETE FROM [tbl_payrollsettings_salary_advance];
        DELETE FROM [tbl_payrollsettings_statutory_config];
        DELETE FROM [tbl_professional_tax_slab];
        DELETE FROM [tbl_esi_mst];
        DELETE FROM [tbl_lwf_mst];

        DELETE FROM [tbl_job_assignment_history];
        DELETE FROM [tbl_job_attachments];
        DELETE FROM [tbl_job_comments];
        DELETE FROM [tbl_job_custom_field_value];
        DELETE FROM [tbl_job_custom_field_definition];
        DELETE FROM [tbl_job_id_sequence];
        DELETE FROM [tbl_job_priority];
        DELETE FROM [tbl_job_status_history];
        DELETE FROM [tbl_job_status_transition];
        DELETE FROM [tbl_job_status];
        DELETE FROM [tbl_job_time_log];
        DELETE FROM [tbl_job_type];
        DELETE FROM [tbl_job];

        DELETE FROM [tbl_upload_errors];
        DELETE FROM [tbl_upload_records];
        DELETE FROM [tbl_upload_batch];
        DELETE FROM [tbl_upload_template_downloads];

        DELETE FROM [chat_presence];
        DELETE FROM [chat_read_receipts];
        DELETE FROM [chat_room_members];
        DELETE FROM [chat_messages];
        DELETE FROM [chat_rooms];
        DELETE FROM [tbl_chatbot_messages];
        DELETE FROM [tbl_chatbot_sessions];

        -- C. CLEAR DYNAMIC MASTER INSTANCES (New clients create their own master records):
        DELETE FROM [tbl_hierarchy_mst];
        DELETE FROM [tbl_department_mst];
        DELETE FROM [tbl_designation_mst];
        DELETE FROM [tbl_branch_mst];
        DELETE FROM [tbl_city_mst];
        DELETE FROM [tbl_state_mst];
        DELETE FROM [tbl_country_mst];
        DELETE FROM [tbl_currency_mst];
        DELETE FROM [tbl_holiday_calendar_mst];
        DELETE FROM [tbl_holiday_mst];
        DELETE FROM [tbl_holiday_type_mst];

        -- Re-enable constraints
        EXEC sp_MSforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL";

        USE master;
    `;
    await sql.query(cleanSql);
    console.log(`✅ Cleaned [PPP_TemplateDB].`);

    // 4. Verification of counts
    console.log(`4. Verifying Table Row Counts:`);
    const checkCounts = [
        { table: 'tbl_company_roles', expectedMin: 1 },
        { table: 'tbl_main_menus', expectedMin: 1 },
        { table: 'tbl_sub_menus', expectedMin: 1 },
        { table: 'tbl_role_menus', expectedMin: 1 },
        { table: 'tbl_master_header', expectedMin: 1 },
        { table: 'tbl_master_fields', expectedMin: 1 },
        { table: 'tbl_emp_mst_controls', expectedMin: 1 },
        { table: 'tbl_salary_component_type', expectedMin: 0, mustBeZero: true },
        { table: 'tbl_slry_comp_calculation_type', expectedMin: 0, mustBeZero: true },
        { table: 'tbl_leave_type', expectedMin: 0, mustBeZero: true },
        { table: 'tbl_salary_components', expectedMin: 0, mustBeZero: true },
        { table: 'tbl_employee_mst', expectedMin: 0, mustBeZero: true },
        { table: 'tbl_country_mst', expectedMin: 0, mustBeZero: true },
        { table: 'tbl_state_mst', expectedMin: 0, mustBeZero: true },
        { table: 'tbl_city_mst', expectedMin: 0, mustBeZero: true },
        { table: 'tbl_currency_mst', expectedMin: 0, mustBeZero: true }
    ];

    const results = {};
    for (const item of checkCounts) {
        const r = await sql.query(`SELECT COUNT(*) AS c FROM [PPP_TemplateDB].[dbo].[${item.table}]`);
        const count = r.recordset[0].c;
        results[item.table] = count;
        const statusIcon = item.mustBeZero ? (count === 0 ? '✅ (Empty as required)' : '❌ (FAILED: Not empty)') : (count > 0 ? '✅ (Preserved)' : '❌ (FAILED: Empty)');
        console.log(`   ${item.table.padEnd(32)}: ${count} rows ${statusIcon}`);
    }

    // 5. Back up PPP_TemplateDB to final backup file
    console.log(`5. Backing up [PPP_TemplateDB] to: ${masterBakFile}...`);
    await sql.query(`
        BACKUP DATABASE [PPP_TemplateDB] 
        TO DISK = '${masterBakFile.replace(/'/g, "''")}' 
        WITH INIT, FORMAT
    `);
    console.log(`✅ Master template backup created successfully.`);

    // Try copying to project backup directory if feasible
    try {
        if (fs.existsSync(masterBakFile)) {
            fs.copyFileSync(masterBakFile, localBakCopy);
            console.log(`✅ Copied backup file to project repository: ${localBakCopy}`);
        }
    } catch (copyErr) {
        console.warn(`Note: Could not copy to local directory:`, copyErr.message);
    }

    // Clean up temporary backup
    if (fs.existsSync(tempBakFile)) {
        try { fs.unlinkSync(tempBakFile); } catch (e) { }
    }

    return {
        success: true,
        masterBakFile,
        localBakCopy,
        tableCounts: results,
        timestamp: new Date()
    };
}

if (require.main === module) {
    createTemplateDatabase()
        .then(res => {
            console.log('\n🎉 TEMPLATE DATABASE GENERATION COMPLETE!');
            console.log(JSON.stringify(res, null, 2));
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Error generating template DB:', err);
            process.exit(1);
        });
}

module.exports = { createTemplateDatabase };
