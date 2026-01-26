const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
}

async function connectToDb() {
    try {
        await sql.connect(config);
        console.log('Connected to SQL Server completedly ✅');
    } catch (err) {
        console.error('❌ DB Connection Error:', err)
    }
}

module.exports = { sql, connectToDb }
