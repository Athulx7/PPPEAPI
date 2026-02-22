
const { getTenantDB } = require("../../DB/connectTenantDB");
const { generateJWT } = require("../../Middleware/jwtMiddleware");
const { getCompany, getUserByEmail } = require("../../Repositories/login/authRepo");
const sql = require("mssql");
const bcrypt = require("bcrypt");

async function login(req, res) {
    try {
        const { email, company_code, password } = req.body;

        const company = await getCompany(company_code);
        if (!company) {
            return res.status(200).json({
                success: false,
                message: "Invalid company code"
            });
        }

        const user = await getUserByEmail(email, company_code);
        if (!user) {
            return res.status(200).json({
                success: false,
                message: "Invalid email address"
            });
        }

        if (!user.is_active) {
            return res.status(200).json({
                success: false,
                message: "User account is inactive"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(200).json({
                success: false,
                message: "Invalid password"
            });
        }

        const tenantDB = await getTenantDB(
            company.db_name,
            company.db_host,
            company.db_user,
            company.db_password
        );

        const tenantRequest = tenantDB.request();

        const userInfoCheck = await tenantRequest
            .input("emp_code_ui", sql.VarChar, user.user_code)
            .query(`
                SELECT emp_code, is_active
                FROM tbl_user_info
                WHERE emp_code = @emp_code_ui
            `);

        if (!userInfoCheck.recordset.length) {
            return res.status(200).json({
                success: false,
                message: "Login mapping not found in company database"
            });
        }

        if (!userInfoCheck.recordset[0].is_active) {
            return res.status(200).json({
                success: false,
                message: "User login is inactive in company"
            });
        }

        const employeeCheck = await tenantRequest
            .input("emp_code_emp", sql.VarChar, user.user_code)
            .query(`
                SELECT emp_code, is_active
                FROM tbl_employee_mst
                WHERE emp_code = @emp_code_emp
            `);

        if (!employeeCheck.recordset.length) {
            return res.status(200).json({
                success: false,
                message: "Employee record not found"
            });
        }

        if (!employeeCheck.recordset[0].is_active) {
            return res.status(200).json({
                success: false,
                message: "Employee is inactive"
            });
        }

        const tokenPayload = {
            user_id: user.user_id,
            user_code: user.user_code,
            email: user.email,
            role_code: user.role_code,
            role_name: user.role_name,
            company_code: company.company_code,
            company_name: company.company_name,
            db_name: company.db_name
        };

        const token = generateJWT(tokenPayload);

        return res.json({
            success: true,
            message: "Login successful",
            token,
            user: {
                user_code: user.user_code,
                email: user.email,
                role_name: user.role_name,
                role_code: user.role_code
            },
            company: {
                company_name: company.company_name,
                company_code: company.company_code,
            }
        });


    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Login failed",
            error: err.message
        });
    }
}
module.exports = { login };
