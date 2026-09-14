require('dotenv').config();
const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT),
    database: 'PPPA',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
}

async function check() {
    try {
        await sql.connect(config);
        const res = await sql.query(`
            SELECT COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'tbl_job_status'
        `);
        console.log(JSON.stringify(res.recordset, null, 2));
        
        const res2 = await sql.query(`
            SELECT * FROM tbl_job_status
        `);
        console.log("DATA:");
        console.log(JSON.stringify(res2.recordset, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        sql.close();
    }
}
check();
