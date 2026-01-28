const { sql } = require("../../DB/db_Connection");

async function getCompany(company_code) {
    const request = new sql.Request();
    request.input("company_code", sql.VarChar, company_code);

    const result = await request.query(`
        SELECT *
        FROM tbl_companies
        WHERE company_code = @company_code
          AND active = 1
    `);

    return result.recordset[0];
}

async function getUserByEmail(email, company_code) {
    const request = new sql.Request();
    request.input("email", sql.VarChar, email);
    request.input("company_code", sql.VarChar, company_code);

    const result = await request.query(`
        SELECT 
            u.user_id,
            u.user_code,
            u.email,
            u.password_hash,
            u.company_code,
            u.role_code,
            u.is_active,
            r.role_name
        FROM tbl_global_users u
        LEFT JOIN tbl_roles r ON u.role_code = r.role_code
        WHERE u.email = @email
          AND u.company_code = @company_code
    `);

    return result.recordset[0];
}

module.exports = { getCompany, getUserByEmail }