const sql = require("mssql");

async function getDownlineLeaveRequestsRepo(req) {
    const userCode = req.user?.user_code || req.user?.emp_code;
    const db = req.tenantDB;

    // 1. Fetch logged-in user's role, department, and hierarchy code
    const userReq = db.request();
    userReq.input("user_code", sql.VarChar, userCode);
    const userRes = await userReq.query(`
        SELECT emp_code, hierarchy_code, department_code, role_code
        FROM tbl_employee_mst
        WHERE emp_code = @user_code;
    `);

    const userInfo = userRes.recordset?.[0] || {};
    const userRole = (userInfo.role_code || '').toUpperCase();
    const userDept = (userInfo.department_code || '').toUpperCase();
    const userHierarchy = userInfo.hierarchy_code || '';
    const isHrOrAdmin = userRole === 'HR' || userRole === 'ADMIN' || userDept === 'HR' || userDept === 'DP002';

    // 2. Query leave requests based on hierarchy code, HR routing, and reporting manager logic
    const request = db.request();
    request.input("user_code", sql.VarChar, userCode);
    request.input("user_hierarchy", sql.VarChar, userHierarchy);

    const query = `
        SELECT
            lr.id,
            lr.request_code,
            lr.emp_code,
            ISNULL(emp.first_name + ' ' + ISNULL(emp.last_name, ''), lr.emp_code) AS emp_name,
            emp.department_code AS department,
            emp.designation_code AS designation,
            emp.reporting_manager_code,
            lr.leave_type_id,
            lt.LeaveTypeCode AS leave_type,
            lt.LeaveTypeName AS leave_name,
            lt.approver_heihrarchy_code,
            FORMAT(lr.from_date, 'yyyy-MM-dd') AS from_date,
            FORMAT(lr.to_date, 'yyyy-MM-dd') AS to_date,
            lr.total_days AS days,
            lr.is_half_day,
            lr.half_day_session,
            lr.reason,
            lr.contact_number,
            lr.address_during_leave AS address,
            lr.handover_notes,
            lr.is_urgent AS urgent,
            LOWER(lr.status) AS status,
            FORMAT(lr.applied_on, 'yyyy-MM-dd') AS applied_on,
            lr.approved_by,
            FORMAT(lr.approved_on, 'yyyy-MM-dd HH:mm') AS approved_on,
            lr.comments
        FROM tbl_leave_request lr
        LEFT JOIN tbl_employee_mst emp ON emp.emp_code = lr.emp_code
        LEFT JOIN tbl_leave_type lt ON lt.id = lr.leave_type_id
        WHERE (
            (${isHrOrAdmin ? '1=1' : 'lr.emp_code <> @user_code AND (emp.reporting_manager_code = @user_code OR (lt.approver_heihrarchy_code IS NOT NULL AND lt.approver_heihrarchy_code = @user_hierarchy AND lt.approver_heihrarchy_code <> \'HR\'))'})
        )
        ORDER BY lr.id DESC;
    `;

    const result = await request.query(query);
    return {
        data: result.recordset || [],
        user: {
            user_code: userCode,
            role_code: userRole,
            department_code: userDept,
            hierarchy_code: userHierarchy,
            is_hr_or_admin: isHrOrAdmin
        }
    };
}

async function approveLeaveRequestRepo(req) {
    const managerCode = req.user?.user_code || req.user?.emp_code;
    const { id, comments = '' } = req.body || {};
    const db = req.tenantDB;
    const request = db.request();

    if (!id) {
        throw new Error("Request ID is required for approval.");
    }

    request.input("id", sql.Int, parseInt(id, 10));
    request.input("manager_code", sql.VarChar, managerCode);
    request.input("comments", sql.VarChar, comments);
    request.input("status", sql.VarChar, "Approved");

    const query = `
        UPDATE tbl_leave_request
        SET status = @status,
            approved_by = @manager_code,
            approved_on = GETDATE(),
            comments = @comments,
            modified_by = @manager_code,
            modified_date = GETDATE()
        WHERE id = @id;
    `;

    await request.query(query);

    return {
        success: true,
        message: "Leave request approved successfully"
    };
}

async function rejectLeaveRequestRepo(req) {
    const managerCode = req.user?.user_code || req.user?.emp_code;
    const { id, comments = '' } = req.body || {};
    const db = req.tenantDB;
    const request = db.request();

    if (!id) {
        throw new Error("Request ID is required for rejection.");
    }

    request.input("id", sql.Int, parseInt(id, 10));
    request.input("manager_code", sql.VarChar, managerCode);
    request.input("comments", sql.VarChar, comments);
    request.input("status", sql.VarChar, "Rejected");

    const query = `
        UPDATE tbl_leave_request
        SET status = @status,
            approved_by = @manager_code,
            approved_on = GETDATE(),
            comments = @comments,
            updated_date = GETDATE()
        WHERE id = @id;
    `;

    await request.query(query);

    return {
        success: true,
        message: "Leave request rejected successfully"
    };
}

module.exports = {
    getDownlineLeaveRequestsRepo,
    approveLeaveRequestRepo,
    rejectLeaveRequestRepo
};
