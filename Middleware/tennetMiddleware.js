const { validateJWT } = require("../Middleware/jwtMiddleware");
const { getTenantDB } = require("../DB/connectTenantDB");
const { getCompany } = require("../Repositories/login/authRepo");

async function tenantResolver(req, res, next) {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader) {
            return res.status(401).json({ message: "Authorization header missing" })
        }

        const token = authHeader.split(" ")[1]
        const claims = validateJWT(token)
        req.user = claims;
        req.companyCode = claims.company_code

        const company = await getCompany(claims.company_code)
        if (!company) {
            return res.status(401).json({ message: "Invalid company" })
        }

        req.tenantDB = await getTenantDB(
            company.db_name,
            company.db_host,
            company.db_user,
            company.db_password
        )

        next()
    } catch (err) {
        return res.status(401).json({
            message: "Invalid or expired token",
            error: err.message
        })
    }
}

module.exports = { tenantResolver }
