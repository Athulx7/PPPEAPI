const sql = require("mssql")
const bcrypt = require("bcrypt")
const { v4: uuidv4 } = require("uuid")

async function saveEmpMaster(req) {

    const tenantDB = req.tenantDB
    const companyCode = req.companyCode
    console.log('company code', companyCode)
    const formData = req.body

    const transaction = new sql.Transaction(tenantDB)

    try {

        await transaction.begin()
        const request = new sql.Request(transaction)

        for (let key in formData) {
            if (formData[key] === "") {
                formData[key] = null
            }
        }

        const controlsResult = await request.query(`
            SELECT column_name, required
            FROM tbl_emp_mst_controls
            WHERE visible = 1 AND is_disable = 0
        `)

        const controls = controlsResult.recordset
        const allowedColumns = controls.map(c => c.column_name)

        for (let control of controls) {
            if (control.required && !formData[control.column_name]) {
                throw new Error(`${control.column_name} is required`)
            }
        }

        if (formData.email) {

            const emailCheckTenant = await request
                .input("email_check", sql.VarChar, formData.email)
                .query(`
                    SELECT 1
                    FROM tbl_employee_mst
                    WHERE email = @email_check
                `)

            if (emailCheckTenant.recordset.length > 0) {
                throw new Error("Email already exists in this company")
            }

            const emailCheckAdmin = await request
                .input("email_check_admin", sql.VarChar, formData.email)
                .input("company_code_check", sql.VarChar, companyCode)
                .query(`
                    SELECT 1
                    FROM PPP_AdminDB.dbo.tbl_global_users
                    WHERE email = @email_check_admin
                    AND company_code = @company_code_check
                `)

            if (emailCheckAdmin.recordset.length > 0) {
                throw new Error("Email already exists for login in this company")
            }
        }

        const roleCode = formData.role_code || "EMPLOYEE"

        const filteredData = {}

        for (let key in formData) {
            if (allowedColumns.includes(key)) {
                filteredData[key] = formData[key]
            }
        }

        filteredData.role_code = roleCode

        const columns = Object.keys(filteredData)

        if (!columns.length) {
            throw new Error("No valid fields provided")
        }

        const values = columns.map(col => `@${col}`)

        const insertQuery = `
            INSERT INTO tbl_employee_mst
            (${columns.join(", ")}, created_at)
            VALUES
            (${values.join(", ")}, GETDATE())
        `

        columns.forEach(col => {
            request.input(col, filteredData[col])
        })

        await request.query(insertQuery)

        const passwordHash = await bcrypt.hash(formData.emp_code, 10)

        await request
            .input("emp_code_login", sql.VarChar, formData.emp_code)
            .input("email_login", sql.VarChar, formData.email)
            .input("password_hash", sql.VarChar, passwordHash)
            .input("role_code_login", sql.VarChar, roleCode)
            .query(`
                INSERT INTO tbl_user_info
                (emp_code, email, password_hash, role_code, is_active, created_at)
                VALUES
                (@emp_code_login, @email_login, @password_hash,
                 @role_code_login, 1, GETDATE())
            `)

        await request
            .input("user_id", sql.UniqueIdentifier, uuidv4())
            .input("user_code", sql.VarChar, formData.emp_code)
            .input("company_code", sql.VarChar, companyCode)
            .input("email_admin", sql.VarChar, formData.email)
            .input("password_hash_admin", sql.VarChar, passwordHash)
            .input("role_code_admin", sql.VarChar, roleCode)
            .query(`
                INSERT INTO PPP_AdminDB.dbo.tbl_global_users
                (user_id, user_code, company_code, email,
                 password_hash, role_code, is_active, created_at)
                VALUES
                (@user_id, @user_code, @company_code, @email_admin,
                 @password_hash_admin, @role_code_admin, 1, GETDATE())
            `)

        await transaction.commit()

        return {
            success: true,
            message: "Employee created successfully"
        }

    } catch (err) {

        await transaction.rollback()
        throw err
    }
}

async function updateEmpMaster(req) {

    const tenantDB = req.tenantDB
    const companyCode = req.companyCode
    const { id } = req.params
    const formData = req.body

    const transaction = new sql.Transaction(tenantDB)

    try {

        await transaction.begin()
        const request = new sql.Request(transaction)

        for (let key in formData) {
            if (formData[key] === "") {
                formData[key] = null
            }
        }

        let updateFields = []

        for (let key in formData) {
            if (key !== "emp_code" && key !== "roles") {
                updateFields.push(`${key} = @${key}`)
                request.input(key, formData[key])
            }
        }

        request.input("emp_code", sql.VarChar, id)

        await request.query(`
            UPDATE tbl_employee_mst
            SET ${updateFields.join(", ")},
                updated_at = GETDATE()
            WHERE emp_code = @emp_code
        `)

        if (
            formData.email ||
            formData.role_code ||
            formData.is_active !== undefined
        ) {

            const loginRequest = new sql.Request(transaction)

            loginRequest.input("emp_code", sql.VarChar, id)

            let loginUpdateFields = []

            if (formData.email) {
                loginRequest.input("email", sql.VarChar, formData.email)
                loginUpdateFields.push("email = @email")
            }

            if (formData.role_code) {
                loginRequest.input("role_code", sql.VarChar, formData.role_code)
                loginUpdateFields.push("role_code = @role_code")
            }

            if (formData.is_active !== undefined) {
                loginRequest.input("is_active", sql.Bit, formData.is_active)
                loginUpdateFields.push("is_active = @is_active")
            }

            if (loginUpdateFields.length > 0) {

                await loginRequest.query(`
                    UPDATE tbl_user_info
                    SET ${loginUpdateFields.join(", ")}
                    WHERE emp_code = @emp_code
                `)

                await loginRequest
                    .input("company_code", sql.VarChar, companyCode)
                    .query(`
                        UPDATE PPP_AdminDB.dbo.tbl_global_users
                        SET ${loginUpdateFields.join(", ")}
                        WHERE user_code = @emp_code
                        AND company_code = @company_code
                    `)
            }
        }

        await transaction.commit()

        return { success: true }

    } catch (err) {

        await transaction.rollback()
        throw err
    }
}

module.exports = { saveEmpMaster, updateEmpMaster }