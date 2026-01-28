const sql = require("mssql")

const tenantDBs = {}

async function connectTenantDB(host, user, pass, dbName) {
    const config = {
        user,
        password: pass,
        server: host,
        database: dbName,
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        },
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    }

    try {
        const pool = await new sql.ConnectionPool(config).connect()
        console.log(`✅ Connected to DB: ${dbName}`)
        return pool
    } catch (err) {
        console.error(`❌ Error connecting DB (${dbName}):`, err)
        throw err
    }
}

async function getTenantDB(dbName, host, user, pass) {
    if (tenantDBs[dbName]) {
        return tenantDBs[dbName]
    }

    tenantDBs[dbName] = await connectTenantDB(host, user, pass, dbName)
    return tenantDBs[dbName]
}

module.exports = { getTenantDB }