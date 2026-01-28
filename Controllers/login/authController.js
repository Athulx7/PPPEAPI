
const { getTenantDB } = require("../../DB/connectTenantDB");
const { generateJWT } = require("../../Middleware/jwtMiddleware");
const { getCompany, getUserByEmail } = require("../../Repositories/login/authRepo");

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

        // const isMatch = await bcrypt.compare(password, user.password_hash);
        // if (!isMatch) {
        //     return res.status(401).json({
        //         success: false,
        //         message: "Invalid password"
        //     });
        // }

        const tenantDB = await getTenantDB(
            company.db_name,
            company.db_host,
            company.db_user,
            company.db_password
        );

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
                role_name: user.role_name
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
