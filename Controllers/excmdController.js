const { getUserByEmail } = require("../Repositories/login/authRepo")
const bcrypt = require("bcrypt")

async function executeQuery(req, res) {
    try {
        const { query, password } = req.body
        
        if (req.user.role_code !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: "Access Denied: Only ADMIN role is authorized to execute commands."
            })
        }
        
        if (!query || typeof query !== 'string' || !query.trim()) {
            return res.status(400).json({
                success: false,
                message: "Query parameter is required."
            })
        }
        
        if (!password) {
            return res.status(400).json({
                success: false,
                message: "Password verification is required."
            })
        }
        
        const user = await getUserByEmail(req.user.email, req.companyCode)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            })
        }
        
        const isMatch = await bcrypt.compare(password, user.password_hash)
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid verification password."
            });
        }

        let cleanQuery = query.replace(/\/\*[\s\S]*?\*\//g, '')
        cleanQuery = cleanQuery.replace(/--.*$/gm, '')
        cleanQuery = cleanQuery.trim()

        if (!/^select\b/i.test(cleanQuery)) {
            return res.status(400).json({
                success: false,
                message: "Only SELECT queries are allowed."
            })
        }

        const forbiddenKeywords = ['insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate', 'exec', 'execute', 'into', 'merge', 'reconfigure']
        const hasForbidden = forbiddenKeywords.some(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'i')
            return regex.test(cleanQuery)
        })
        
        if (hasForbidden) {
            return res.status(400).json({
                success: false,
                message: "Security violation: Query contains modification keywords (INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, EXEC, INTO, etc.)."
            })
        }

        const pool = req.tenantDB
        const result = await pool.request().query(query)

        const rows = result.recordset || []
        const columns = rows.length > 0 ? Object.keys(rows[0]) : (result.recordset && result.recordset.columns ? Object.keys(result.recordset.columns) : [])
        
        return res.status(200).json({
            success: true,
            columns,
            data: rows,
            message: "Query executed successfully."
        })
        
    } catch (err) {
        console.error("executeQuery error:", err)
        return res.status(500).json({
            success: false,
            message: "Database execution failed.",
            error: err.message
        })
    }
}

module.exports = { executeQuery }
