const sql = require("mssql")

function calculateSalaryFromComponents(components = []) {
    const values = {};

    components.forEach(c => {
        if (!c.formula_expression && !c.percentage_value) {
            values[c.component_code] = parseFloat(c.fixed_amount) || 0
        }
    })

    components.forEach(c => {
        if (c.percentage_value && c.base_component_code) {
            const base = values[c.base_component_code] || 0
            values[c.component_code] = (parseFloat(c.percentage_value) / 100) * base
        }
    })

    components.forEach(c => {
        if (c.formula_expression) {
            let formula = c.formula_expression
            Object.keys(values).forEach(code => {
                formula = formula.replace(new RegExp(`\\b${code}\\b`, 'g'), values[code])
            })
            try {
                values[c.component_code] = eval(formula)
            } catch {
                values[c.component_code] = 0
            }
        }
    })

    let add = 0, sub = 0
    components.forEach(c => {
        const val = values[c.component_code] || 0
        if (c.payroll_impact === 'add') add += val
        else if (c.payroll_impact === 'sub') sub += val
    })

    return add - sub
}

async function getSalaryAdvanceInfoRepo(req) {
    const db = req.tenantDB
    const userCode = req.user?.emp_code || req.user?.user_code || req.user?.id

    if (!userCode) {
        throw new Error("User session invalid or emp_code missing")
    }

    const empReq = db.request()
    empReq.input("emp_code", sql.VarChar, userCode)
    const empResult = await empReq.query(`
        SELECT 
            e.id,
            e.emp_code,
            e.first_name,
            e.last_name,
            e.joining_date,
            e.employee_type_code,
            e.probation_months,
            e.bank_account_number,
            e.ifsc_code,
            d.depart_name AS department,
            des.desig_name AS designation,
            e.designation_code,
            DATEDIFF(MONTH, e.joining_date, GETDATE()) AS service_months
        FROM tbl_employee_mst e
        LEFT JOIN tbl_department_mst d ON e.department_code = d.depart_code
        LEFT JOIN tbl_designation_mst des ON e.designation_code = des.desig_code
        WHERE e.emp_code = @emp_code
    `)

    if (!empResult.recordset || empResult.recordset.length === 0) {
        throw new Error(`Employee details not found for code: ${userCode}`)
    }

    const emp = empResult.recordset[0]
    const empName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
    const serviceMonths = emp.service_months >= 0 ? emp.service_months : 0

    const salReq = db.request()
    salReq.input("target_code", sql.VarChar, emp.emp_code)
    salReq.input("desig_code", sql.VarChar, emp.designation_code || '')

    const salResult = await salReq.query(`
        SELECT TOP 1
            a.structure_id,
            (
                SELECT 
                    c.component_code,
                    sc.fixed_amount,
                    sc.percentage_value,
                    sc.formula_expression,
                    ct.payroll_impact
                FROM tbl_salary_structure_components sc
                LEFT JOIN tbl_salary_components c ON c.id = sc.component_id
                LEFT JOIN tbl_salary_component_type ct ON ct.type_code = c.type_code
                WHERE sc.structure_id = a.structure_id
                FOR JSON PATH
            ) AS components
        FROM tbl_salary_structure_assignment a
        WHERE (
            (a.assignment_type = 'employee' AND a.target_code = @target_code)
            OR
            (a.assignment_type = 'designation' AND a.target_code = @desig_code)
        )
        ORDER BY CASE WHEN a.assignment_type = 'employee' THEN 1 ELSE 2 END, a.id DESC
    `)

    let calculatedNetSalary = 0
    if (salResult.recordset && salResult.recordset.length > 0) {
        try {
            const components = JSON.parse(salResult.recordset[0].components || '[]')
            calculatedNetSalary = calculateSalaryFromComponents(components)
        } catch (e) {
            console.error("Error parsing salary structure components:", e)
        }
    }

    const monthlySalary = calculatedNetSalary > 0 ? calculatedNetSalary : 45000

    const settingsResult = await db.request().query(`
        SELECT TOP 1 * 
        FROM tbl_payrollsettings_salary_advance 
        WHERE is_active = 1
        ORDER BY id DESC
    `)

    const setting = (settingsResult.recordset && settingsResult.recordset.length > 0) ? settingsResult.recordset[0]
        : {
            minimum_service_months: 4,
            probation_eligible: 0,
            contract_employee_eligible: 0,
            max_advance_percentage: 50.00,
            minimum_advance_amount: 2000.00,
            maximum_advance_amount: 10000.00,
            max_requests_per_month: 1,
            max_requests_per_year: 5,
            recovery_start: 'next_month',
            recovery_method: 'equal_installment',
            max_recovery_months: 5,
            allow_manual_recovery: 0,
            approval_required: 1,
            approval_level: 'HR',
            hr_final_approval: 1,
            auto_approve: 0,
            allow_multiple_pending: 0,
            allow_new_before_settlement: 1,
            deduct_from_final_settlement: 1
        };

    const advReq = db.request()
    advReq.input("emp_code", sql.VarChar, emp.emp_code)
    const advResult = await advReq.query(`
        SELECT 
            status,
            advance_amount,
            remaining_balance
        FROM tbl_salary_advance_request
        WHERE emp_code = @emp_code AND status IN ('pending', 'approved', 'disbursed')
    `)

    let usedAdvances = 0
    let pendingAdvances = 0
    let hasPendingRequest = false
    let hasUnsettledAdvance = false

    (advResult.recordset || []).forEach(row => {
        if (row.status === 'pending') {
            pendingAdvances += parseFloat(row.advance_amount || 0)
            hasPendingRequest = true
        } else if (row.status === 'approved' || row.status === 'disbursed') {
            usedAdvances += parseFloat(row.remaining_balance || 0)
            if (row.remaining_balance > 0) {
                hasUnsettledAdvance = true
            }
        }
    })

    const maxPercent = parseFloat(setting.max_advance_percentage || 50)
    const calculatedMaxBySalary = Math.round(monthlySalary * (maxPercent / 100))

    const setMaxLimit = parseFloat(setting.maximum_advance_amount || 10000)
    const minLimit = parseFloat(setting.minimum_advance_amount || 2000)

    const maxEligibleAmount = Math.min(calculatedMaxBySalary, setMaxLimit)

    const currentCommitments = usedAdvances + pendingAdvances
    const remainingLimit = Math.max(0, maxEligibleAmount - currentCommitments)

    let isEligible = true
    let eligibilityReasons = []

    if (serviceMonths < (setting.minimum_service_months || 0)) {
        isEligible = false
        eligibilityReasons.push(`Requires minimum ${setting.minimum_service_months} months of service (Current: ${serviceMonths} months).`)
    }

    const empType = (emp.employee_type_code || '').toLowerCase()
    const isProbation = empType.includes('probation') || serviceMonths < (emp.probation_months || 0)
    if (isProbation && !setting.probation_eligible) {
        isEligible = false
        eligibilityReasons.push("Employees under probation are not eligible for salary advance.")
    }

    const isContract = empType.includes('contract')
    if (isContract && !setting.contract_employee_eligible) {
        isEligible = false
        eligibilityReasons.push("Contract employees are not eligible for salary advance.")
    }

    if (!setting.allow_multiple_pending && hasPendingRequest) {
        isEligible = false
        eligibilityReasons.push("You already have a pending salary advance request.")
    }

    if (!setting.allow_new_before_settlement && hasUnsettledAdvance) {
        isEligible = false
        eligibilityReasons.push("You cannot apply for a new advance before settling current active advances.")
    }

    if (remainingLimit < minLimit) {
        isEligible = false
        eligibilityReasons.push(`Remaining limit (₹${remainingLimit}) is below the minimum allowed advance (₹${minLimit}).`)
    }

    const maxTenure = parseInt(setting.max_recovery_months || 5)
    const tenureOptions = Array.from({ length: maxTenure }, (_, i) => i + 1)

    return {
        currentUser: {
            emp_code: emp.emp_code,
            emp_name: empName,
            designation: emp.designation || 'N/A',
            department: emp.department || 'N/A',
            doj: emp.joining_date ? emp.joining_date.toISOString().split('T')[0] : '',
            salary: monthlySalary,
            bank_account: emp.bank_account_number || 'XXXX XXXX 1234',
            ifsc: emp.ifsc_code || 'HDFC0001234'
        },
        eligibility: {
            is_eligible: isEligible,
            eligibility_message: eligibilityReasons.join(' '),
            max_eligible_amount: maxEligibleAmount,
            min_amount: minLimit,
            max_amount: setMaxLimit,
            used_advances: usedAdvances,
            pending_advances: pendingAdvances,
            remaining_limit: remainingLimit,
            tenure_options: tenureOptions,
            interest_rate: 0,
            processing_fee: 0
        },
        settings: setting
    }
}

async function getMySalaryAdvanceRequestsRepo(req) {
    const db = req.tenantDB
    const userCode = req.user?.emp_code || req.user?.user_code || req.user?.id

    const request = db.request()
    request.input("emp_code", sql.VarChar, userCode)

    const result = await request.query(`
        SELECT 
            id,
            request_code AS id_code,
            FORMAT(created_at, 'yyyy-MM-dd') AS request_date,
            advance_amount AS amount,
            purpose,
            repayment_tenure AS tenure,
            monthly_deduction,
            status,
            approved_by,
            FORMAT(approved_on, 'yyyy-MM-dd') AS approved_date,
            FORMAT(preferred_date, 'yyyy-MM-dd') AS preferred_date,
            FORMAT(cancelled_on, 'yyyy-MM-dd') AS cancelled_date,
            cancellation_reason,
            rejection_reason,
            remaining_balance,
            comments
        FROM tbl_salary_advance_request
        WHERE emp_code = @emp_code
        ORDER BY id DESC
    `)

    const formattedRequests = result.recordset.map(row => ({
        id: row.id_code,
        db_id: row.id,
        request_date: row.request_date,
        amount: parseFloat(row.amount),
        purpose: row.purpose,
        tenure: row.tenure,
        monthly_deduction: parseFloat(row.monthly_deduction),
        status: row.status,
        approved_by: row.approved_by,
        approved_date: row.approved_date,
        preferred_date: row.preferred_date,
        cancelled_date: row.cancelled_date,
        cancellation_reason: row.cancellation_reason,
        rejection_reason: row.rejection_reason,
        remaining_balance: parseFloat(row.remaining_balance),
        comments: row.comments || ''
    }))

    return formattedRequests
}

async function createSalaryAdvanceRequestRepo(req) {
    const db = req.tenantDB
    const userCode = req.user?.emp_code || req.user?.user_code || req.user?.id

    const {
        advance_amount,
        purpose,
        repayment_tenure,
        preferred_date,
        emergency_contact,
        emergency_relation,
        comments,
        supporting_documents
    } = req.body

    const amount = parseFloat(advance_amount)
    const tenure = parseInt(repayment_tenure)

    if (!amount || amount <= 0) throw new Error("Invalid advance amount")
    if (!purpose || purpose.trim().length < 10) throw new Error("Purpose must be at least 10 characters")
    if (!tenure || tenure <= 0) throw new Error("Invalid repayment tenure")

    const info = await getSalaryAdvanceInfoRepo(req)
    if (!info.eligibility.is_eligible) {
        throw new Error(info.eligibility.eligibility_message || "You are not eligible to request salary advance.")
    }

    if (amount < info.eligibility.min_amount) {
        throw new Error(`Minimum advance amount is ₹${info.eligibility.min_amount}`)
    }

    if (amount > info.eligibility.remaining_limit) {
        throw new Error(`Maximum eligible remaining advance amount is ₹${info.eligibility.remaining_limit}`)
    }

    const monthlyDeduction = Math.round(amount / tenure)
    const requestCode = `SAR${Date.now()}`
    const initialStatus = info.settings.auto_approve ? 'approved' : 'pending'

    const insertReq = db.request()
    insertReq.input("request_code", sql.VarChar, requestCode)
    insertReq.input("emp_code", sql.VarChar, userCode)
    insertReq.input("advance_amount", sql.Decimal(18, 2), amount)
    insertReq.input("purpose", sql.NVarChar, purpose)
    insertReq.input("repayment_tenure", sql.Int, tenure)
    insertReq.input("monthly_deduction", sql.Decimal(18, 2), monthlyDeduction)
    insertReq.input("preferred_date", sql.Date, preferred_date || null)
    insertReq.input("emergency_contact", sql.VarChar, emergency_contact || null)
    insertReq.input("emergency_relation", sql.NVarChar, emergency_relation || null)
    insertReq.input("comments", sql.NVarChar, comments || null)
    insertReq.input("supporting_documents", sql.NVarChar, JSON.stringify(supporting_documents || []))
    insertReq.input("status", sql.VarChar, initialStatus)
    insertReq.input("remaining_balance", sql.Decimal(18, 2), amount)

    await insertReq.query(`
        INSERT INTO tbl_salary_advance_request (
            request_code, emp_code, advance_amount, purpose, repayment_tenure,
            monthly_deduction, preferred_date, emergency_contact, emergency_relation,
            comments, supporting_documents, status, remaining_balance
        ) VALUES (
            @request_code, @emp_code, @advance_amount, @purpose, @repayment_tenure,
            @monthly_deduction, @preferred_date, @emergency_contact, @emergency_relation,
            @comments, @supporting_documents, @status, @remaining_balance
        )
    `)

    return {
        request_code: requestCode,
        status: initialStatus,
        message: initialStatus === 'approved' ? "Salary advance request auto-approved successfully." : "Salary advance request submitted successfully."
    }
}

async function cancelSalaryAdvanceRequestRepo(req) {
    const db = req.tenantDB
    const userCode = req.user?.emp_code || req.user?.user_code || req.user?.id
    const { id, cancellation_reason } = req.body

    if (!id) throw new Error("Request ID is required")
    if (!cancellation_reason) throw new Error("Cancellation reason is required")

    const cancelReq = db.request()
    cancelReq.input("request_code", sql.VarChar, id)
    cancelReq.input("emp_code", sql.VarChar, userCode)
    cancelReq.input("cancellation_reason", sql.NVarChar, cancellation_reason)

    const result = await cancelReq.query(`
        UPDATE tbl_salary_advance_request
        SET status = 'cancelled',
            cancellation_reason = @cancellation_reason,
            cancelled_on = GETDATE(),
            updated_at = GETDATE()
        WHERE request_code = @request_code AND emp_code = @emp_code AND status = 'pending'
    `)

    if (result.rowsAffected[0] === 0) {
        throw new Error("Unable to cancel request. Ensure the request exists and is in 'pending' status.")
    }

    return { message: "Request cancelled successfully" }
}

// 5. Get Approval / Downline Requests List for Manager & HR
async function getDownlineSalaryAdvanceRequestsRepo(req) {
    const db = req.tenantDB
    const userCode = req.user?.emp_code || req.user?.user_code || req.user?.id

    const userReq = db.request()
    userReq.input("user_code", sql.VarChar, userCode)
    const userRes = await userReq.query(`
        SELECT 
            e.emp_code,
            CONCAT(e.first_name, ' ', ISNULL(e.last_name, '')) AS emp_name,
            e.department_code,
            e.designation_code,
            e.role_code,
            d.depart_name AS department,
            des.desig_name AS designation
        FROM tbl_employee_mst e
        LEFT JOIN tbl_department_mst d ON e.department_code = d.depart_code
        LEFT JOIN tbl_designation_mst des ON e.designation_code = des.desig_code
        WHERE e.emp_code = @user_code;
    `)

    const userInfo = userRes.recordset?.[0] || {}
    const userRole = (userInfo.role_code || '').toUpperCase()
    const userDept = (userInfo.department_code || '').toUpperCase()
    const isHrOrAdmin = userRole === 'HR' || userRole === 'ADMIN' || userDept === 'HR' || userDept === 'DP002'

    const reqQuery = db.request()
    reqQuery.input("user_code", sql.VarChar, userCode)

    const result = await reqQuery.query(`
        SELECT 
            sar.id AS db_id,
            sar.request_code AS id,
            sar.emp_code,
            CONCAT(e.first_name, ' ', ISNULL(e.last_name, '')) AS emp_name,
            des.desig_name AS designation,
            e.department_code,
            d.depart_name AS department,
            FORMAT(e.joining_date, 'yyyy-MM-dd') AS doj,
            FORMAT(sar.created_at, 'yyyy-MM-dd') AS request_date,
            sar.advance_amount AS amount,
            sar.purpose,
            sar.repayment_tenure AS tenure,
            sar.monthly_deduction,
            FORMAT(sar.preferred_date, 'yyyy-MM-dd') AS preferred_date,
            sar.emergency_contact,
            sar.emergency_relation,
            sar.comments,
            LOWER(sar.status) AS status,
            sar.supporting_documents,
            ISNULL(appr.first_name + ' ' + ISNULL(appr.last_name, ''), sar.approved_by) AS approved_by,
            FORMAT(sar.approved_on, 'yyyy-MM-dd HH:mm') AS approved_date,
            ISNULL(rej.first_name + ' ' + ISNULL(rej.last_name, ''), sar.rejected_by) AS rejected_by,
            FORMAT(sar.rejected_on, 'yyyy-MM-dd HH:mm') AS rejected_date,
            sar.rejection_reason,
            ISNULL(disb.first_name + ' ' + ISNULL(disb.last_name, ''), sar.disbursed_by) AS disbursed_by,
            FORMAT(sar.disbursed_on, 'yyyy-MM-dd') AS disbursed_date,
            sar.disbursement_ref,
            sar.disbursement_mode,
            sar.remaining_balance
        FROM tbl_salary_advance_request sar
        LEFT JOIN tbl_employee_mst e ON e.emp_code = sar.emp_code
        LEFT JOIN tbl_department_mst d ON e.department_code = d.depart_code
        LEFT JOIN tbl_designation_mst des ON e.designation_code = des.desig_code
        LEFT JOIN tbl_employee_mst appr ON appr.emp_code = sar.approved_by
        LEFT JOIN tbl_employee_mst rej ON rej.emp_code = sar.rejected_by
        LEFT JOIN tbl_employee_mst disb ON disb.emp_code = sar.disbursed_by
        WHERE (
            (${isHrOrAdmin ? '1=1' : 'sar.emp_code <> @user_code AND e.reporting_manager_code = @user_code'})
        )
        ORDER BY sar.id DESC
    `)

    // Fetch department list from tbl_department_mst
    const deptQuery = db.request()
    deptQuery.input("user_code", sql.VarChar, userCode)
    
    let deptSql = ""
    if (isHrOrAdmin) {
        deptSql = `
            SELECT depart_code AS value, depart_name AS label 
            FROM tbl_department_mst 
            WHERE is_active = 1 
            ORDER BY depart_name
        `
    } else {
        deptSql = `
            SELECT DISTINCT d.depart_code AS value, d.depart_name AS label
            FROM tbl_department_mst d
            INNER JOIN tbl_employee_mst e ON e.department_code = d.depart_code
            WHERE e.reporting_manager_code = @user_code OR e.emp_code = @user_code
            ORDER BY d.depart_name
        `
    }

    const deptResult = await deptQuery.query(deptSql)
    const departmentOptions = deptResult.recordset.map(row => ({
        value: row.value,
        label: row.label
    }))

    const formattedRequests = result.recordset.map(row => {
        let documents = []
        try {
            documents = JSON.parse(row.supporting_documents || '[]')
        } catch {
            documents = []
        }

        return {
            id: row.id,
            db_id: row.db_id,
            emp_code: row.emp_code,
            emp_name: row.emp_name || row.emp_code,
            designation: row.designation || 'N/A',
            department_code: row.department_code || '',
            department: row.department || 'N/A',
            doj: row.doj || '',
            salary: 45000,
            request_date: row.request_date,
            amount: parseFloat(row.amount || 0),
            purpose: row.purpose || '',
            tenure: parseInt(row.tenure || 1),
            monthly_deduction: parseFloat(row.monthly_deduction || 0),
            preferred_date: row.preferred_date || '',
            emergency_contact: row.emergency_contact || '',
            emergency_relation: row.emergency_relation || '',
            comments: row.comments || '',
            status: row.status,
            documents: Array.isArray(documents) ? documents : [],
            approved_by: row.approved_by,
            approved_date: row.approved_date,
            rejected_by: row.rejected_by,
            rejected_date: row.rejected_date,
            rejection_reason: row.rejection_reason,
            disbursed_by: row.disbursed_by,
            disbursed_date: row.disbursed_date,
            disbursement_ref: row.disbursement_ref,
            disbursement_mode: row.disbursement_mode,
            remaining_balance: parseFloat(row.remaining_balance || 0),
            eligibility: {
                max_eligible: 100000,
                used: 0,
                remaining: 100000
            }
        }
    })

    return {
        requests: formattedRequests,
        departments: [{ value: '', label: 'All Departments' }, ...departmentOptions],
        currentUser: {
            emp_code: userInfo.emp_code || userCode,
            emp_name: userInfo.emp_name || 'Approver',
            role: userRole.toLowerCase() || 'manager',
            designation: userInfo.designation || 'Approver',
            department: userInfo.department || 'Management'
        }
    }
}

// 6. Approve Salary Advance Request
async function approveSalaryAdvanceRequestRepo(req) {
    const db = req.tenantDB
    const managerCode = req.user?.emp_code || req.user?.user_code || req.user?.id
    const { id, comments = '' } = req.body || {}

    if (!id) throw new Error("Request ID is required")

    const appReq = db.request()
    appReq.input("request_code", sql.VarChar, id)
    appReq.input("approved_by", sql.VarChar, managerCode)
    appReq.input("comments", sql.NVarChar, comments)

    const result = await appReq.query(`
        UPDATE tbl_salary_advance_request
        SET status = 'approved',
            approved_by = @approved_by,
            approved_on = GETDATE(),
            comments = CASE WHEN @comments <> '' THEN @comments ELSE comments END,
            updated_at = GETDATE()
        WHERE request_code = @request_code AND status = 'pending'
    `)

    if (result.rowsAffected[0] === 0) {
        throw new Error("Unable to approve request. Ensure request exists and is in 'pending' status.")
    }

    return { message: "Salary advance request approved successfully." }
}

// 7. Reject Salary Advance Request
async function rejectSalaryAdvanceRequestRepo(req) {
    const db = req.tenantDB
    const managerCode = req.user?.emp_code || req.user?.user_code || req.user?.id
    const { id, rejection_reason } = req.body || {}

    if (!id) throw new Error("Request ID is required")
    if (!rejection_reason) throw new Error("Rejection reason is required")

    const rejReq = db.request()
    rejReq.input("request_code", sql.VarChar, id)
    rejReq.input("rejected_by", sql.VarChar, managerCode)
    rejReq.input("rejection_reason", sql.NVarChar, rejection_reason)

    const result = await rejReq.query(`
        UPDATE tbl_salary_advance_request
        SET status = 'rejected',
            rejected_by = @rejected_by,
            rejected_on = GETDATE(),
            rejection_reason = @rejection_reason,
            updated_at = GETDATE()
        WHERE request_code = @request_code AND status = 'pending'
    `)

    if (result.rowsAffected[0] === 0) {
        throw new Error("Unable to reject request. Ensure request exists and is in 'pending' status.")
    }

    return { message: "Salary advance request rejected successfully." }
}

// 8. Disburse Salary Advance Request
async function disburseSalaryAdvanceRequestRepo(req) {
    const db = req.tenantDB
    const managerCode = req.user?.emp_code || req.user?.user_code || req.user?.id
    const { id, mode, reference, date } = req.body || {}

    if (!id) throw new Error("Request ID is required")
    if (!reference) throw new Error("Disbursement transaction reference is required")

    const disbReq = db.request()
    disbReq.input("request_code", sql.VarChar, id)
    disbReq.input("disbursed_by", sql.VarChar, managerCode)
    disbReq.input("disbursed_on", sql.DateTime, date ? new Date(date) : new Date())
    disbReq.input("disbursement_ref", sql.VarChar, reference)
    disbReq.input("disbursement_mode", sql.VarChar, mode || 'bank_transfer')

    const result = await disbReq.query(`
        UPDATE tbl_salary_advance_request
        SET status = 'disbursed',
            disbursed_by = @disbursed_by,
            disbursed_on = @disbursed_on,
            disbursement_ref = @disbursement_ref,
            disbursement_mode = @disbursement_mode,
            updated_at = GETDATE()
        WHERE request_code = @request_code AND status = 'approved'
    `)

    if (result.rowsAffected[0] === 0) {
        throw new Error("Unable to disburse request. Ensure request exists and is in 'approved' status.")
    }

    return { message: "Salary advance marked as disbursed successfully." }
}

module.exports = {
    getSalaryAdvanceInfoRepo,
    getMySalaryAdvanceRequestsRepo,
    createSalaryAdvanceRequestRepo,
    cancelSalaryAdvanceRequestRepo,
    getDownlineSalaryAdvanceRequestsRepo,
    approveSalaryAdvanceRequestRepo,
    rejectSalaryAdvanceRequestRepo,
    disburseSalaryAdvanceRequestRepo
}
