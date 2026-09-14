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

async function fixStatuses() {
    try {
        await sql.connect(config);
        await sql.query(`
            UPDATE tbl_job_status
            SET is_final = 0
            WHERE id IN (1, 2) -- Open and Running
        `);
        console.log("Successfully updated is_final for Open and Running statuses.");
        
        const res2 = await sql.query(`
            SELECT * FROM tbl_job_status
        `);
        console.log(JSON.stringify(res2.recordset, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        sql.close();
    }
}
fixStatuses();
