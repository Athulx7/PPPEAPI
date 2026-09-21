const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sql, connectToDb } = require('../DB/db_Connection');
const bcrypt = require('bcrypt');

async function setupSystemAdmin() {
    await connectToDb();

    console.log('1. Checking and creating tbl_system_admins in PPP_AdminDB...');
    await sql.query(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tbl_system_admins')
        BEGIN
            CREATE TABLE tbl_system_admins (
                admin_id INT IDENTITY(1,1) PRIMARY KEY,
                username VARCHAR(100) NOT NULL UNIQUE,
                email VARCHAR(150) NOT NULL UNIQUE,
                password_hash NVARCHAR(MAX) NOT NULL,
                full_name VARCHAR(150),
                role VARCHAR(50) DEFAULT 'SUPER_ADMIN',
                is_active BIT DEFAULT 1,
                created_at DATETIME2 DEFAULT SYSDATETIME(),
                last_login DATETIME2
            );
            PRINT 'Created tbl_system_admins';
        END
    `);

    // Add SYSTEM_ADMIN to tbl_roles if not exists
    await sql.query(`
        IF NOT EXISTS (SELECT * FROM tbl_roles WHERE role_code = 'SYSTEM_ADMIN')
        BEGIN
            INSERT INTO tbl_roles (role_code, role_name, description)
            VALUES ('SYSTEM_ADMIN', 'System Administrator', 'Platform Super Admin access');
        END
    `);

    // Seed default system admin
    const defaultEmail = 'sysadmin@ppp.com';
    const defaultUsername = 'sysadmin';
    const defaultPass = 'SysAdmin@2026';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(defaultPass, saltRounds);

    const existingAdmin = await sql.query(`
        SELECT admin_id FROM tbl_system_admins WHERE email = '${defaultEmail}' OR username = '${defaultUsername}'
    `);

    if (existingAdmin.recordset.length === 0) {
        await sql.query(`
            INSERT INTO tbl_system_admins (username, email, password_hash, full_name, role, is_active)
            VALUES ('${defaultUsername}', '${defaultEmail}', '${passwordHash}', 'Platform System Admin', 'SUPER_ADMIN', 1)
        `);
        console.log(`✅ Default System Admin created:`);
        console.log(`   Email: ${defaultEmail}`);
        console.log(`   Username: ${defaultUsername}`);
        console.log(`   Password: ${defaultPass}`);
    } else {
        // Update password hash to ensure it's valid
        await sql.query(`
            UPDATE tbl_system_admins 
            SET password_hash = '${passwordHash}', is_active = 1
            WHERE email = '${defaultEmail}' OR username = '${defaultUsername}'
        `);
        console.log(`✅ Default System Admin updated:`);
        console.log(`   Email: ${defaultEmail}`);
        console.log(`   Username: ${defaultUsername}`);
        console.log(`   Password: ${defaultPass}`);
    }

    // Ensure subscription columns exist in tbl_companies
    await sql.query(`
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tbl_companies') AND name = 'subscription_plan')
            ALTER TABLE tbl_companies ADD subscription_plan VARCHAR(50);
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tbl_companies') AND name = 'subscription_status')
            ALTER TABLE tbl_companies ADD subscription_status VARCHAR(50);
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tbl_companies') AND name = 'trial_start_date')
            ALTER TABLE tbl_companies ADD trial_start_date DATETIME2;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tbl_companies') AND name = 'trial_end_date')
            ALTER TABLE tbl_companies ADD trial_end_date DATETIME2;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tbl_companies') AND name = 'subscription_start_date')
            ALTER TABLE tbl_companies ADD subscription_start_date DATETIME2;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tbl_companies') AND name = 'subscription_end_date')
            ALTER TABLE tbl_companies ADD subscription_end_date DATETIME2;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tbl_companies') AND name = 'max_employees')
            ALTER TABLE tbl_companies ADD max_employees INT;
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tbl_companies') AND name = 'contact_person')
            ALTER TABLE tbl_companies ADD contact_person VARCHAR(100);
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tbl_companies') AND name = 'contact_email')
            ALTER TABLE tbl_companies ADD contact_email VARCHAR(150);
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tbl_companies') AND name = 'contact_phone')
            ALTER TABLE tbl_companies ADD contact_phone VARCHAR(50);
    `);
    console.log('✅ tbl_companies subscription columns verified.');

    process.exit(0);
}

setupSystemAdmin().catch(e => {
    console.error('setupSystemAdmin error:', e);
    process.exit(1);
});
