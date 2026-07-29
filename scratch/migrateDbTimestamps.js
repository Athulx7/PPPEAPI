require("dotenv").config({ path: "../.env" })
const { getTenantDB } = require("../DB/connectTenantDB")
const { connectToDb } = require("../DB/db_Connection")
const { getCompany } = require("../Repositories/login/authRepo")
const sql = require("mssql")

async function runMigration() {
    
    try {
        await connectToDb()
    } catch (err) {
        console.error("❌ Failed to connect to central database:", err.message)
        process.exit(1)
    }

    const testCompanyCode = "PPPA"
    const company = await getCompany(testCompanyCode)
    if (!company) {
        console.error("Company not found in central database.")
        process.exit(1)
    }

    let tenantDB
    try {
        tenantDB = await getTenantDB(
            company.db_name,
            company.db_host,
            company.db_user,
            company.db_password
        )
    } catch (err) {
        console.error("Failed to connect to tenant database:", err.message)
        process.exit(1)
    }

    async function migrateColumn(tableName, columnName) {
        console.log(`Migrating default constraint on ${tableName}.${columnName}...`)
        const query = `
            DECLARE @ConstraintName nvarchar(200)
            SELECT @ConstraintName = Name FROM sys.default_constraints
            WHERE parent_object_id = object_id('${tableName}')
              AND parent_column_id = Columnproperty(object_id('${tableName}'), '${columnName}', 'ColumnId')
            IF @ConstraintName IS NOT NULL
              EXEC('ALTER TABLE ${tableName} DROP CONSTRAINT ' + @ConstraintName)
            ALTER TABLE ${tableName} ADD CONSTRAINT DF_${tableName}_${columnName} DEFAULT GETUTCDATE() FOR ${columnName}
        `
        await tenantDB.request().query(query)
    }

    try {
        await migrateColumn("tbl_chatbot_sessions", "created_at")
        await migrateColumn("tbl_chatbot_sessions", "updated_at")
        await migrateColumn("tbl_chatbot_messages", "timestamp")
    } catch (err) {
        console.error("Migration failed:", err.message)
    } finally {
        await sql.close()
    }
}

runMigration()
