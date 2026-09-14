const sql = require('mssql')
const bcrypt = require('bcrypt')
const { sql: adminSql } = require('../../DB/db_Connection')

async function getUserProfileRepository(req) {
    const userCode = req.user.user_code
    const request = req.tenantDB.request()
    request.input("emp_code", sql.VarChar, userCode)
    const result = await request.query(`
            SELECT 
                e.id,
                e.emp_code,
                e.first_name,
                e.last_name,
                e.email,
                e.department_code,
                d.depart_name AS department,
                e.designation_code,
                des.desig_name AS designation,
                e.joining_date,
                e.currency_code,
				c.name,
                e.hierarchy_code,
				h.hierarchy_name,
                e.reporting_manager_code,
                m.first_name + ' ' + m.last_name AS reporting_manager_name,
                e.address_line1,
                e.address_line2,
                e.city,
                e.state,
                e.country,
                e.postal_code,
                e.pan_number,
                e.mobile_number,
                e.alternate_mobile,
                e.date_of_birth,
                e.gender,
                e.marital_status,
                e.employee_type_code,
				et.name,
                e.probation_months,
                e.probation_end_date,
                e.bank_account_number,
                e.account_holder_name,
                e.bank_name,
                e.ifsc_code,
                e.branch_name,
                e.account_type,
                e.emergency_contact_name,
                e.emergency_contact_number,
                e.emergency_contact_relation,
                e.highest_qualification,
                e.university,
                e.year_of_passing,
                e.is_active,
                e.created_at,
                e.updated_at,
                e.role_code
            FROM tbl_employee_mst e
            LEFT JOIN tbl_department_mst d ON e.department_code = d.depart_code
            LEFT JOIN tbl_designation_mst des ON e.designation_code = des.desig_code
			left join tbl_hierarchy_mst h on e.hierarchy_code = h.hierarchy_code
            LEFT JOIN tbl_employee_mst m ON e.reporting_manager_code = m.emp_code
			left join tbl_currency_mst c on e.currency_code = c.currency_code
			left join tbl_employee_type_mst et on e.employee_type_code = et.employee_type_code
            WHERE e.emp_code = @emp_code
        `)
    if (!result.recordset || result.recordset.length === 0) {
        return res.status(404).json({
            success: false,
            message: "Employee profile not found"
        })
    }

    const emp = result.recordset[0]
    const profileData = {
        employeeCode: emp.emp_code || '',
        employeeId: emp.emp_code || '',
        firstName: emp.first_name || '',
        lastName: emp.last_name || '',
        email: emp.email || '',
        roles: emp.role_code ? [emp.role_code] : ['Employee'],

        department: emp.department || emp.department_code || '',
        designation: emp.designation || emp.designation_code || '',
        joiningDate: emp.joining_date ? new Date(emp.joining_date).toISOString().split('T')[0] : '',
        employeeType: emp.employee_type_code || 'Permanent',
        probationPeriod: emp.probation_months || 0,
        probationEndDate: emp.probation_end_date ? new Date(emp.probation_end_date).toISOString().split('T')[0] : '',
        reportingManager: emp.reporting_manager_name || emp.reporting_manager_code || '',
        currency: emp.currency_code || 'INR - Indian Rupee',

        addressLine1: emp.address_line1 || '',
        addressLine2: emp.address_line2 || '',
        city: emp.city || '',
        state: emp.state || '',
        country: emp.country || '',
        pincode: emp.postal_code || '',

        panNumber: emp.pan_number || '',
        mobileNumber: emp.mobile_number || '',
        alternateMobile: emp.alternate_mobile || '',
        dateOfBirth: emp.date_of_birth ? new Date(emp.date_of_birth).toISOString().split('T')[0] : '',
        gender: emp.gender || '',
        maritalStatus: emp.marital_status || '',

        accountNumber: emp.bank_account_number || '',
        accountHolderName: emp.account_holder_name || ((emp.first_name || '') + ' ' + (emp.last_name || '')).trim(),
        bankName: emp.bank_name || '',
        ifscCode: emp.ifsc_code || '',
        branchName: emp.branch_name || '',
        accountType: emp.account_type || 'Savings',

        emergencyContactName: emp.emergency_contact_name || '',
        emergencyContactNumber: emp.emergency_contact_number || '',
        emergencyContactRelation: emp.emergency_contact_relation || '',

        highestQualification: emp.highest_qualification || '',
         university: emp.university || '',
        yearOfPassing: emp.year_of_passing || '',

        status: emp.is_active ? 'Active' : 'Inactive',
        lastLogin: emp.updated_at ? new Date(emp.updated_at).toLocaleString() : 'N/A'
    }
    return profileData
}

async function updateUserProfileRepository(req, res) {
    const tenantDB = req.tenantDB
    const userCode = req.user.user_code
    const body = req.body

    const request = tenantDB.request()
    request.input("emp_code", sql.VarChar, userCode)

    request.input("mobile_number", sql.VarChar, body.mobileNumber || null)
    request.input("alternate_mobile", sql.VarChar, body.alternateMobile || null)
    request.input("pan_number", sql.VarChar, body.panNumber || null)
    request.input("date_of_birth", sql.VarChar, body.dateOfBirth || null)
    request.input("gender", sql.VarChar, body.gender || null)
    request.input("marital_status", sql.VarChar, body.maritalStatus || null)

    request.input("address_line1", sql.VarChar, body.addressLine1 || null)
    request.input("address_line2", sql.VarChar, body.addressLine2 || null)
    request.input("city", sql.VarChar, body.city || null)
    request.input("state", sql.VarChar, body.state || null)
    request.input("postal_code", sql.VarChar, body.pincode || null)
    request.input("country", sql.VarChar, body.country || null)

    request.input("bank_account_number", sql.VarChar, body.accountNumber || null)
    request.input("account_holder_name", sql.VarChar, body.accountHolderName || null)
    request.input("bank_name", sql.VarChar, body.bankName || null)
    request.input("ifsc_code", sql.VarChar, body.ifscCode || null)
    request.input("branch_name", sql.VarChar, body.branchName || null)
    request.input("account_type", sql.VarChar, body.accountType || null)

    request.input("emergency_contact_name", sql.VarChar, body.emergencyContactName || null)
    request.input("emergency_contact_number", sql.VarChar, body.emergencyContactNumber || null)
    request.input("emergency_contact_relation", sql.VarChar, body.emergencyContactRelation || null)

    request.input("highest_qualification", sql.VarChar, body.highestQualification || null)
     request.input("university", sql.VarChar, body.university || null)
     request.input("year_of_passing", sql.VarChar, body.yearOfPassing || null)

    await request.query(`
                UPDATE tbl_employee_mst
                SET 
                    mobile_number = @mobile_number,
                    alternate_mobile = @alternate_mobile,
                    pan_number = @pan_number,
                    date_of_birth = @date_of_birth,
                    gender = @gender,
                    marital_status = @marital_status,
                    address_line1 = @address_line1,
                    address_line2 = @address_line2,
                    city = @city,
                    state = @state,
                    postal_code = @postal_code,
                    country = @country,
                    bank_account_number = @bank_account_number,
                    account_holder_name = @account_holder_name,
                    bank_name = @bank_name,
                    ifsc_code = @ifsc_code,
                    branch_name = @branch_name,
                    account_type = @account_type,
                    emergency_contact_name = @emergency_contact_name,
                    emergency_contact_number = @emergency_contact_number,
                    emergency_contact_relation = @emergency_contact_relation,
                    highest_qualification = @highest_qualification,
                    university = @university,
                    year_of_passing = @year_of_passing,
                    updated_at = GETDATE()
                WHERE emp_code = @emp_code
            `)
    return { success: true, message: "User profile updated successfully" }
}

async function changePasswordRepository(req) {
    const tenantDB = req.tenantDB
    const userCode = req.user?.user_code || req.user?.emp_code
    const companyCode = req.companyCode || req.user?.company_code
    const { currentPassword, newPassword, confirmPassword } = req.body || {}

    if (!userCode) {
        throw new Error("User identification not found in session.")
    }

    if (!currentPassword) {
        throw new Error("Current password is required.")
    }

    if (!newPassword) {
        throw new Error("New password is required.")
    }

    if (!confirmPassword) {
        throw new Error("Please confirm your new password.")
    }

    const trimmedNew = String(newPassword).trim()
    const trimmedConfirm = String(confirmPassword).trim()

    if (trimmedNew !== trimmedConfirm) {
        throw new Error("New password and confirm password do not match.")
    }

    // Validation rule:
    // - Single character or single symbol is NOT allowed (e.g. 'a', '@' are rejected)
    // - Single digit IS allowed (e.g. '0'-'9')
    // - Multiple characters, multiple digits, symbols, and mixed are allowed (length >= 2)
    if (trimmedNew.length === 1 && !/^\d$/.test(trimmedNew)) {
        throw new Error("A single letter or single symbol is not allowed. A single-character password must be a digit (0-9). For letters and symbols, please use 2 or more characters.")
    }

    // 1. Fetch current password hash from tenant DB tbl_user_info
    const tenantCheckReq = tenantDB.request()
    tenantCheckReq.input("emp_code", sql.VarChar, userCode)
    const tenantRes = await tenantCheckReq.query(`
        SELECT emp_code, email, password_hash
        FROM tbl_user_info
        WHERE emp_code = @emp_code
    `)

    let existingHash = tenantRes.recordset[0]?.password_hash

    // Fallback: check admin DB tbl_global_users if not found in tenant DB
    if (!existingHash) {
        try {
            const adminCheckReq = new adminSql.Request()
            adminCheckReq.input("user_code", adminSql.VarChar, userCode)
            adminCheckReq.input("company_code", adminSql.VarChar, companyCode)
            const adminRes = await adminCheckReq.query(`
                SELECT password_hash
                FROM tbl_global_users
                WHERE user_code = @user_code AND company_code = @company_code
            `)
            existingHash = adminRes.recordset[0]?.password_hash
        } catch (adminErr) {
            console.warn("Admin DB lookup note:", adminErr.message)
        }
    }

    if (!existingHash) {
        throw new Error("User credentials record could not be found.")
    }

    // Verify current password with bcrypt
    const isCurrentMatch = await bcrypt.compare(String(currentPassword), existingHash)
    if (!isCurrentMatch) {
        throw new Error("Incorrect current password. Default password is your Employee Code.")
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(trimmedNew, existingHash)
    if (isSamePassword) {
        throw new Error("New password cannot be the same as your current password.")
    }

    // Generate new bcrypt hash
    const newPasswordHash = await bcrypt.hash(trimmedNew, 10)

    // 2. Update Tenant DB tbl_user_info
    const tenantUpdateReq = tenantDB.request()
    tenantUpdateReq.input("emp_code", sql.VarChar, userCode)
    tenantUpdateReq.input("password_hash", sql.VarChar, newPasswordHash)
    await tenantUpdateReq.query(`
        UPDATE tbl_user_info
        SET password_hash = @password_hash
        WHERE emp_code = @emp_code
    `)

    // 3. Update Central Admin DB tbl_global_users
    let adminUpdated = false
    try {
        const adminUpdateReq = new adminSql.Request()
        adminUpdateReq.input("user_code", adminSql.VarChar, userCode)
        adminUpdateReq.input("company_code", adminSql.VarChar, companyCode)
        adminUpdateReq.input("password_hash", adminSql.VarChar, newPasswordHash)
        const adminResult = await adminUpdateReq.query(`
            UPDATE tbl_global_users
            SET password_hash = @password_hash
            WHERE user_code = @user_code AND company_code = @company_code
        `)
        if (adminResult.rowsAffected && adminResult.rowsAffected[0] > 0) {
            adminUpdated = true
        }
    } catch (adminErr) {
        console.warn("Direct adminSql update error, attempting cross-database fallback:", adminErr.message)
    }

    // Cross-database query fallback on PPP_AdminDB.dbo.tbl_global_users
    if (!adminUpdated) {
        try {
            const crossDbReq = tenantDB.request()
            crossDbReq.input("user_code", sql.VarChar, userCode)
            crossDbReq.input("company_code", sql.VarChar, companyCode)
            crossDbReq.input("password_hash", sql.VarChar, newPasswordHash)
            await crossDbReq.query(`
                UPDATE PPP_AdminDB.dbo.tbl_global_users
                SET password_hash = @password_hash
                WHERE user_code = @user_code AND company_code = @company_code
            `)
        } catch (crossErr) {
            console.warn("Cross-database update warning:", crossErr.message)
        }
    }

    return {
        success: true,
        message: "Password changed successfully."
    }
}

module.exports = { getUserProfileRepository, updateUserProfileRepository, changePasswordRepository }