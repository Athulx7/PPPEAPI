const { sql } = require('../../DB/db_Connection');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { generateJWT } = require('../../Middleware/jwtMiddleware');
const { createTemplateDatabase } = require('../../scripts/generateTemplateDB');

// Helper to sanitize database names (only alphanumeric and underscore)
function sanitizeDbName(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * System Admin Login
 */
async function authenticateSystemAdmin(usernameOrEmail, password) {
    const request = new sql.Request();
    request.input('loginInput', sql.VarChar, usernameOrEmail);

    const result = await request.query(`
        SELECT admin_id, username, email, password_hash, full_name, role, is_active
        FROM tbl_system_admins
        WHERE (email = @loginInput OR username = @loginInput)
    `);

    const admin = result.recordset[0];
    if (!admin) {
        return { success: false, message: 'Invalid credentials' };
    }

    if (!admin.is_active) {
        return { success: false, message: 'Administrator account is deactivated' };
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
        return { success: false, message: 'Invalid credentials' };
    }

    // Update last login
    const updateReq = new sql.Request();
    updateReq.input('admin_id', sql.Int, admin.admin_id);
    await updateReq.query(`
        UPDATE tbl_system_admins
        SET last_login = SYSDATETIME()
        WHERE admin_id = @admin_id
    `);

    const tokenPayload = {
        admin_id: admin.admin_id,
        user_id: `SYS-${admin.admin_id}`,
        username: admin.username,
        email: admin.email,
        full_name: admin.full_name,
        role_code: 'SYSTEM_ADMIN',
        role_name: 'System Administrator'
    };

    const token = generateJWT(tokenPayload);

    return {
        success: true,
        token,
        admin: {
            admin_id: admin.admin_id,
            username: admin.username,
            email: admin.email,
            full_name: admin.full_name,
            role_code: 'SYSTEM_ADMIN'
        }
    };
}

/**
 * System Dashboard Metrics
 */
async function getDashboardMetrics() {
    const result = await sql.query(`
        SELECT 
            COUNT(*) AS total_clients,
            SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active_clients,
            SUM(CASE WHEN subscription_status = 'TRIAL' OR subscription_plan = 'TRIAL' THEN 1 ELSE 0 END) AS trial_clients,
            SUM(CASE WHEN active = 0 OR subscription_status = 'SUSPENDED' THEN 1 ELSE 0 END) AS suspended_clients,
            SUM(CASE 
                WHEN (COALESCE(subscription_end_date, trial_end_date) < SYSDATETIME()) THEN 1 
                ELSE 0 
            END) AS expired_clients,
            SUM(CASE 
                WHEN (COALESCE(subscription_end_date, trial_end_date) >= SYSDATETIME() 
                     AND COALESCE(subscription_end_date, trial_end_date) <= DATEADD(day, 7, SYSDATETIME())) THEN 1 
                ELSE 0 
            END) AS expiring_soon_clients
        FROM tbl_companies
    `);

    const metrics = result.recordset[0] || {};
    return {
        totalClients: metrics.total_clients || 0,
        activeClients: metrics.active_clients || 0,
        trialClients: metrics.trial_clients || 0,
        suspendedClients: metrics.suspendedClients || metrics.suspended_clients || 0,
        expiredClients: metrics.expired_clients || 0,
        expiringSoonClients: metrics.expiring_soon_clients || 0
    };
}

/**
 * Get All Clients with Calculated Subscription Status
 */
async function getAllClients(searchTerm = '', statusFilter = 'ALL') {
    let query = `
        SELECT 
            c.company_code,
            c.company_name,
            c.db_name,
            c.db_host,
            c.db_port,
            c.active,
            c.created_at,
            c.subscription_plan,
            c.subscription_status,
            c.trial_start_date,
            c.trial_end_date,
            c.subscription_start_date,
            c.subscription_end_date,
            c.max_employees,
            c.contact_person,
            c.contact_email,
            c.contact_phone
        FROM tbl_companies c
        WHERE 1 = 1
    `;

    const request = new sql.Request();

    if (searchTerm && searchTerm.trim()) {
        request.input('searchTerm', sql.VarChar, `%${searchTerm.trim()}%`);
        query += ` AND (c.company_code LIKE @searchTerm OR c.company_name LIKE @searchTerm OR c.contact_email LIKE @searchTerm OR c.contact_person LIKE @searchTerm)`;
    }

    query += ` ORDER BY c.created_at DESC`;

    const result = await request.query(query);
    const now = new Date();

    const clients = result.recordset.map(comp => {
        const effectiveEndDate = comp.subscription_end_date || comp.trial_end_date;
        let daysRemaining = null;
        let effectiveStatus = comp.active === 0 ? 'SUSPENDED' : (comp.subscription_status || 'ACTIVE');

        if (effectiveEndDate) {
            const endDateObj = new Date(effectiveEndDate);
            const diffTime = endDateObj.getTime() - now.getTime();
            daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (comp.active === 1) {
                if (daysRemaining < 0) {
                    effectiveStatus = 'EXPIRED';
                } else if (daysRemaining <= 7) {
                    effectiveStatus = 'EXPIRING_SOON';
                } else if (comp.subscription_plan === 'TRIAL' || comp.subscription_status === 'TRIAL') {
                    effectiveStatus = 'TRIAL';
                } else {
                    effectiveStatus = 'ACTIVE';
                }
            }
        }

        return {
            ...comp,
            effectiveEndDate,
            daysRemaining,
            calculatedStatus: effectiveStatus
        };
    });

    if (statusFilter && statusFilter !== 'ALL') {
        return clients.filter(c => c.calculatedStatus === statusFilter || c.subscription_status === statusFilter);
    }

    return clients;
}

/**
 * Get Template Config (Default Roles, Masters, and Field Labels)
 */
async function getTemplateConfig() {
    // Read directly from PPP_TemplateDB
    const rolesRes = await sql.query(`
        SELECT role_code, role_name, description, default_route
        FROM [PPP_TemplateDB].[dbo].[tbl_company_roles]
        WHERE is_active = 1
        ORDER BY role_code
    `);

    const masterHeadersRes = await sql.query(`
        SELECT id, menu_id, master_code, table_name, header_name, list_title
        FROM [PPP_TemplateDB].[dbo].[tbl_master_header]
        WHERE is_active = 1
        ORDER BY id
    `);

    const masterFieldsRes = await sql.query(`
        SELECT f.id, f.master_id, h.master_code, f.column_name, f.label, f.list_label
        FROM [PPP_TemplateDB].[dbo].[tbl_master_fields] f
        JOIN [PPP_TemplateDB].[dbo].[tbl_master_header] h ON f.master_id = h.id
        WHERE f.visible = 1
        ORDER BY f.master_id, f.priority
    `);

    const empControlsRes = await sql.query(`
        SELECT id, column_name, label, list_label, required, visible, priority
        FROM [PPP_TemplateDB].[dbo].[tbl_emp_mst_controls]
        WHERE visible = 1
        ORDER BY priority
    `);

    return {
        roles: rolesRes.recordset,
        masterHeaders: masterHeadersRes.recordset,
        masterFields: masterFieldsRes.recordset,
        empControls: empControlsRes.recordset
    };
}

/**
 * Provision New Client Database and Register in Admin DB
 */
async function provisionClient(data) {
    const {
        company_code,
        company_name,
        contact_person,
        contact_email,
        contact_phone,
        admin_email,
        admin_password,
        subscription_plan = 'TRIAL',
        trial_duration_days = 14,
        subscription_end_date = null,
        max_employees = 50,
        is_customized = false,
        customizations = {}
    } = data;

    // 1. Validation
    const cleanCode = (company_code || '').trim().toUpperCase();
    if (!cleanCode || !/^[A-Z0-9]{3,10}$/.test(cleanCode)) {
        throw new Error('Invalid Company Code. Must be 3-10 uppercase alphanumeric characters (e.g. CMP01, ACME).');
    }

    if (!company_name || !company_name.trim()) {
        throw new Error('Company Name is required.');
    }

    if (!admin_email || !admin_email.trim()) {
        throw new Error('Admin Email is required.');
    }

    if (!admin_password || admin_password.length < 4) {
        throw new Error('Admin Password must be at least 4 characters.');
    }

    // Check if company code already exists in tbl_companies
    const checkCompany = await sql.query(`
        SELECT company_code FROM [PPP_AdminDB].[dbo].[tbl_companies] WHERE company_code = '${cleanCode}'
    `);
    if (checkCompany.recordset.length > 0) {
        throw new Error(`Company code '${cleanCode}' already exists.`);
    }

    // Check if DB already exists in SQL Server
    const checkDb = await sql.query(`
        SELECT name FROM sys.databases WHERE name = '${cleanCode}'
    `);
    if (checkDb.recordset.length > 0) {
        throw new Error(`Database '${cleanCode}' already exists on the SQL Server.`);
    }

    // 2. Resolve backup file path
    const pathRes = await sql.query(`
        SELECT 
            SERVERPROPERTY('InstanceDefaultDataPath') as data_path,
            SERVERPROPERTY('InstanceDefaultBackupPath') as backup_path
    `);
    const dataPath = pathRes.recordset[0].data_path;
    const backupPath = pathRes.recordset[0].backup_path || dataPath;
    let templateBakFile = path.join(backupPath, 'PPP_TemplateDB.bak');

    // If template backup doesn't exist, regenerate it automatically
    if (!fs.existsSync(templateBakFile)) {
        console.log('Template backup file not found, auto-generating...');
        await createTemplateDatabase();
    }

    // Determine logical names inside backup file
    const fileList = await sql.query(`RESTORE FILELISTONLY FROM DISK = '${templateBakFile.replace(/'/g, "''")}'`);
    const dataLogical = fileList.recordset.find(f => f.Type === 'D')?.LogicalName || 'PPPA';
    const logLogical = fileList.recordset.find(f => f.Type === 'L')?.LogicalName || 'PPPA_log';

    const targetMdf = path.join(dataPath, `${cleanCode}.mdf`);
    const targetLdf = path.join(dataPath, `${cleanCode}_log.ldf`);

    console.log(`Restoring database [${cleanCode}] from [${templateBakFile}]...`);
    await sql.query(`
        RESTORE DATABASE [${cleanCode}]
        FROM DISK = '${templateBakFile.replace(/'/g, "''")}'
        WITH 
            MOVE '${dataLogical}' TO '${targetMdf.replace(/'/g, "''")}',
            MOVE '${logLogical}' TO '${targetLdf.replace(/'/g, "''")}',
            REPLACE
    `);
    console.log(`✅ Database [${cleanCode}] successfully created.`);

    // 3. Apply customizations if requested (Only names & labels, NEVER IDs or codes!)
    if (is_customized && customizations) {
        console.log(`Applying client customizations for [${cleanCode}]...`);

        // A. Custom Role Names
        if (Array.isArray(customizations.roles)) {
            for (const r of customizations.roles) {
                if (r.role_code && r.role_name) {
                    const req = new sql.Request();
                    req.input('role_code', sql.VarChar, r.role_code);
                    req.input('role_name', sql.NVarChar, r.role_name.trim());
                    await req.query(`
                        UPDATE [${cleanCode}].[dbo].[tbl_company_roles]
                        SET role_name = @role_name
                        WHERE role_code = @role_code
                    `);
                }
            }
        }

        // B. Custom Master Header Names
        if (Array.isArray(customizations.master_headers)) {
            for (const mh of customizations.master_headers) {
                if (mh.master_code && mh.header_name) {
                    const req = new sql.Request();
                    req.input('master_code', sql.VarChar, mh.master_code);
                    req.input('header_name', sql.NVarChar, mh.header_name.trim());
                    req.input('list_title', sql.NVarChar, (mh.list_title || `${mh.header_name} List`).trim());
                    await req.query(`
                        UPDATE [${cleanCode}].[dbo].[tbl_master_header]
                        SET header_name = @header_name,
                            list_title = @list_title
                        WHERE master_code = @master_code
                    `);
                }
            }
        }

        // C. Custom Master Field Labels
        if (Array.isArray(customizations.master_fields)) {
            for (const mf of customizations.master_fields) {
                if (mf.id && mf.label) {
                    const req = new sql.Request();
                    req.input('id', sql.Int, parseInt(mf.id));
                    req.input('label', sql.NVarChar, mf.label.trim());
                    req.input('list_label', sql.NVarChar, (mf.list_label || mf.label).trim());
                    await req.query(`
                        UPDATE [${cleanCode}].[dbo].[tbl_master_fields]
                        SET label = @label,
                            list_label = @list_label
                        WHERE id = @id
                    `);
                }
            }
        }

        // D. Custom Employee Master Control Labels
        if (Array.isArray(customizations.emp_controls)) {
            for (const ec of customizations.emp_controls) {
                if (ec.column_name && ec.label) {
                    const req = new sql.Request();
                    req.input('col_name', sql.VarChar, ec.column_name);
                    req.input('label', sql.NVarChar, ec.label.trim());
                    req.input('list_label', sql.NVarChar, (ec.list_label || ec.label).trim());
                    await req.query(`
                        UPDATE [${cleanCode}].[dbo].[tbl_emp_mst_controls]
                        SET label = @label,
                            list_label = @list_label
                        WHERE column_name = @col_name
                    `);
                }
            }
        }
        console.log(`✅ Customizations applied.`);
    }

    // 4. Create Initial Company Administrator User
    console.log(`Setting up Initial Admin account for [${cleanCode}]...`);
    const passwordHash = await bcrypt.hash(admin_password, 10);
    const adminUserId = uuidv4();
    const adminUserCode = 'ADM001';

    // Insert into PPP_AdminDB.dbo.tbl_global_users
    const globalUserReq = new sql.Request();
    globalUserReq.input('user_id', sql.UniqueIdentifier, adminUserId);
    globalUserReq.input('user_code', sql.VarChar, adminUserCode);
    globalUserReq.input('company_code', sql.VarChar, cleanCode);
    globalUserReq.input('email', sql.VarChar, admin_email.trim().toLowerCase());
    globalUserReq.input('password_hash', sql.NVarChar, passwordHash);
    globalUserReq.input('role_code', sql.VarChar, 'ADMIN');
    await globalUserReq.query(`
        INSERT INTO [PPP_AdminDB].[dbo].[tbl_global_users] (user_id, user_code, company_code, email, password_hash, role_code, is_active, created_at)
        VALUES (@user_id, @user_code, @company_code, @email, @password_hash, @role_code, 1, SYSDATETIME())
    `);

    // Insert into tenant tbl_employee_mst
    const empMstReq = new sql.Request();
    empMstReq.input('emp_code', sql.VarChar, adminUserCode);
    empMstReq.input('first_name', sql.VarChar, 'Admin');
    empMstReq.input('last_name', sql.VarChar, company_name.trim());
    empMstReq.input('email', sql.VarChar, admin_email.trim().toLowerCase());
    await empMstReq.query(`
        INSERT INTO [${cleanCode}].[dbo].[tbl_employee_mst] (
            emp_code, first_name, last_name, email, role_code, is_active, created_at
        ) VALUES (
            @emp_code, @first_name, @last_name, @email, 'ADMIN', 1, SYSDATETIME()
        )
    `);

    // Insert into tenant tbl_user_info
    const userInfoReq = new sql.Request();
    userInfoReq.input('emp_code', sql.VarChar, adminUserCode);
    userInfoReq.input('email', sql.VarChar, admin_email.trim().toLowerCase());
    userInfoReq.input('password_hash', sql.NVarChar, passwordHash);
    userInfoReq.input('role_code', sql.VarChar, 'ADMIN');
    await userInfoReq.query(`
        INSERT INTO [${cleanCode}].[dbo].[tbl_user_info] (
            emp_code, email, password_hash, role_code, is_active, created_at
        ) VALUES (
            @emp_code, @email, @password_hash, @role_code, 1, SYSDATETIME()
        )
    `);
    console.log(`✅ Company Administrator user configured.`);

    // 5. Calculate Subscription Dates
    const now = new Date();
    let trialStart = null;
    let trialEnd = null;
    let subStart = null;
    let subEnd = null;
    let subStatus = 'ACTIVE';

    if (subscription_plan === 'TRIAL') {
        trialStart = now;
        trialEnd = new Date(now.getTime() + (parseInt(trial_duration_days) || 14) * 24 * 60 * 60 * 1000);
        subStatus = 'TRIAL';
    } else {
        subStart = now;
        if (subscription_end_date) {
            subEnd = new Date(subscription_end_date);
        } else {
            // Default 1 year for paid plans
            subEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        }
        subStatus = 'ACTIVE';
    }

    // 6. Register company in PPP_AdminDB.dbo.tbl_companies
    const compReq = new sql.Request();
    compReq.input('company_code', sql.VarChar, cleanCode);
    compReq.input('company_name', sql.VarChar, company_name.trim());
    compReq.input('db_name', sql.VarChar, cleanCode);
    compReq.input('db_host', sql.VarChar, 'localhost');
    compReq.input('db_port', sql.Int, 1433);
    compReq.input('db_user', sql.VarChar, 'sa');
    compReq.input('db_password', sql.NVarChar, process.env.DB_PASS || 'pironserver@5758');
    compReq.input('subscription_plan', sql.VarChar, subscription_plan);
    compReq.input('subscription_status', sql.VarChar, subStatus);
    compReq.input('trial_start_date', sql.DateTime2, trialStart);
    compReq.input('trial_end_date', sql.DateTime2, trialEnd);
    compReq.input('subscription_start_date', sql.DateTime2, subStart);
    compReq.input('subscription_end_date', sql.DateTime2, subEnd);
    compReq.input('max_employees', sql.Int, parseInt(max_employees) || 50);
    compReq.input('contact_person', sql.VarChar, contact_person || null);
    compReq.input('contact_email', sql.VarChar, contact_email || null);
    compReq.input('contact_phone', sql.VarChar, contact_phone || null);

    await compReq.query(`
        INSERT INTO [PPP_AdminDB].[dbo].[tbl_companies] (
            company_code, company_name, db_name, db_host, db_port, db_user, db_password, active, created_at,
            subscription_plan, subscription_status, trial_start_date, trial_end_date, 
            subscription_start_date, subscription_end_date, max_employees, contact_person, contact_email, contact_phone
        ) VALUES (
            @company_code, @company_name, @db_name, @db_host, @db_port, @db_user, @db_password, 1, SYSDATETIME(),
            @subscription_plan, @subscription_status, @trial_start_date, @trial_end_date,
            @subscription_start_date, @subscription_end_date, @max_employees, @contact_person, @contact_email, @contact_phone
        )
    `);
    console.log(`✅ Company [${cleanCode}] registered in Central Catalog.`);

    return {
        success: true,
        company_code: cleanCode,
        company_name,
        db_name: cleanCode,
        admin_email,
        subscription_plan,
        subscription_status: subStatus,
        effectiveEndDate: subEnd || trialEnd,
        message: `Client ${cleanCode} provisioned successfully with database and credentials.`
    };
}

/**
 * Renew or Extend Client Subscription
 */
async function renewClient(company_code, updateData) {
    const {
        subscription_plan,
        subscription_end_date,
        extend_days,
        max_employees,
        subscription_status
    } = updateData;

    const request = new sql.Request();
    request.input('company_code', sql.VarChar, company_code);

    // Calculate new end date
    let endDateClause = '';
    if (subscription_end_date) {
        request.input('end_date', sql.DateTime2, new Date(subscription_end_date));
        endDateClause = `, subscription_end_date = @end_date`;
    } else if (extend_days) {
        request.input('extend_days', sql.Int, parseInt(extend_days));
        endDateClause = `, subscription_end_date = DATEADD(day, @extend_days, COALESCE(subscription_end_date, SYSDATETIME()))`;
    }

    let planClause = '';
    if (subscription_plan) {
        request.input('plan', sql.VarChar, subscription_plan);
        planClause = `, subscription_plan = @plan`;
    }

    let maxEmpClause = '';
    if (max_employees) {
        request.input('max_emp', sql.Int, parseInt(max_employees));
        maxEmpClause = `, max_employees = @max_emp`;
    }

    let statusClause = '';
    const newStatus = subscription_status || 'ACTIVE';
    request.input('status', sql.VarChar, newStatus);
    statusClause = `, subscription_status = @status, active = 1`;

    await request.query(`
        UPDATE [PPP_AdminDB].[dbo].[tbl_companies]
        SET company_code = company_code
            ${planClause}
            ${endDateClause}
            ${maxEmpClause}
            ${statusClause}
        WHERE company_code = @company_code
    `);

    return { success: true, message: `Subscription for ${company_code} updated successfully.` };
}

/**
 * Toggle Client Status (Active / Suspended)
 */
async function toggleClientStatus(company_code, active) {
    const request = new sql.Request();
    request.input('company_code', sql.VarChar, company_code);
    request.input('active', sql.Int, active ? 1 : 0);
    request.input('status', sql.VarChar, active ? 'ACTIVE' : 'SUSPENDED');

    await request.query(`
        UPDATE [PPP_AdminDB].[dbo].[tbl_companies]
        SET active = @active,
            subscription_status = @status
        WHERE company_code = @company_code
    `);

    return { success: true, active: !!active, message: `Client status updated to ${active ? 'Active' : 'Suspended'}.` };
}

module.exports = {
    authenticateSystemAdmin,
    getDashboardMetrics,
    getAllClients,
    getTemplateConfig,
    provisionClient,
    renewClient,
    toggleClientStatus
};
