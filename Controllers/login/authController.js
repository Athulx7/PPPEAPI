
const { getTenantDB } = require("../../DB/connectTenantDB");
const { generateJWT } = require("../../Middleware/jwtMiddleware");
const { getLoginUser } = require("../../Repositories/login/authRepo");

async function login(req, res) {
    try {
        const { email, company_code, password } = req.body;

        const user = await getLoginUser(email, company_code);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or company"
            });
        }

        // if (user.password_hash !== password) {
        //     console.log('invalid pass', user.password_hash, password);
        //     return res.status(401).json({
        //         success: false,
        //         message: "Invalid password"
        //     });
        // }

        const tenantDB = await getTenantDB(
            user.db_name,
            user.db_host,
            user.db_user,
            user.db_password
        );

        const tokenPayload = {
            user_id: user.user_id,
            user_code: user.user_code,
            username: user.username,
            email: user.email,

            company_id: user.company_id,
            company_code: user.company_code,
            company_name: user.company_name,

            role_code: user.role_code,
            role_name: user.role_name,

            db_name: user.db_name
        };

        const token = generateJWT(tokenPayload);

        return res.json({
            success: true,
            message: "Login successful",
            token,
            user: {
                user_code: user.user_code,
                username: user.username,
                email: user.email,
                role_name: user.role_name
            },
            company: {
                company_name: user.company_name,
                company_code: user.company_code,
                database: user.db_name
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
