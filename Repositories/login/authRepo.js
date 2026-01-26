const { sql } = require("../../DB/db_Connection");


async function getLoginUser(email,company_code) {
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
    r.role_name,
    c.company_name,
    c.db_host,
    c.db_port,
    c.db_user,
    c.db_password,
    c.db_name
FROM tbl_global_users u
INNER JOIN tbl_companies c 
    ON u.company_code = c.company_code
LEFT JOIN tbl_roles r 
    ON u.role_code = r.role_code
WHERE 
    u.email = @email
    AND u.company_code = @company_code
    AND u.is_active = 1
    AND c.active = 1;
  `);

    return result.recordset[0];
}

module.exports = { getLoginUser };
