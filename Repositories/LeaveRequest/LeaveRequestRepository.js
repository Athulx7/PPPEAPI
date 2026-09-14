const sql = require("mssql");

async function getUserWorkScheduleRepo(req) {
    const userCode = req.user?.user_code || req.user?.emp_code;
    const db = req.tenantDB;
    const request = db.request();

    request.input("user_code", sql.VarChar, userCode);

    const query = `
        SELECT TOP 1
            id,
            user_code,
            employee_name,
            department,
            designation,
            target_type,
            work_week,
            working_hours_per_day,
            is_fixed_start_end,
            start_time,
            end_time,
            overtime_applicable,
            overtime_rate,
            shift_allowance,
            night_shift_allowance,
            ISNULL(overtime_carry_forward, 0) AS overtime_carry_forward,
            ISNULL(overtime_carry_forward_max_mins, 30) AS overtime_carry_forward_max_mins,
            ISNULL(overtime_carry_forward_scope, 'weekly') AS overtime_carry_forward_scope
        FROM tbl_payroll_employee_work_schedules
        WHERE user_code = @user_code
        ORDER BY id DESC;
    `;

    const result = await request.query(query);
    const schedule = result.recordset[0] || null;

    if (schedule && typeof schedule.work_week === 'string') {
        try {
            schedule.work_week = JSON.parse(schedule.work_week);
        } catch (e) {
            schedule.work_week = schedule.work_week.split(',').map(s => s.trim().toLowerCase());
        }
    }

    return { data: schedule };
}

async function getMyLeaveRequestsRepo(req) {
    const userCode = req.user?.user_code || req.user?.emp_code;
    const db = req.tenantDB;
    const request = db.request();

    request.input("emp_code", sql.VarChar, userCode);

    const query = `
        SELECT
            lr.id,
            lr.request_code,
            lr.emp_code,
            lr.leave_type_id,
            lt.LeaveTypeCode AS leave_type,
            lt.LeaveTypeName AS leave_name,
            FORMAT(lr.from_date, 'yyyy-MM-dd') AS from_date,
            FORMAT(lr.to_date, 'yyyy-MM-dd') AS to_date,
            lr.total_days AS days,
            lr.is_half_day,
            lr.half_day_session,
            lr.reason,
            lr.contact_number,
            lr.address_during_leave AS address,
            lr.handover_notes,
            lr.is_urgent,
            lr.status,
            FORMAT(lr.applied_on, 'yyyy-MM-dd') AS applied_on,
            ISNULL(e.first_name + ' ' + ISNULL(e.last_name, ''), lr.approved_by) AS approved_by,
            FORMAT(lr.approved_on, 'yyyy-MM-dd HH:mm') AS approved_on,
            lr.comments
        FROM tbl_leave_request lr
        LEFT JOIN tbl_leave_type lt ON lt.id = lr.leave_type_id
        LEFT JOIN tbl_employee_mst e ON e.emp_code = lr.approved_by
        WHERE lr.emp_code = @emp_code
        ORDER BY lr.id DESC;
    `;

    const result = await request.query(query);
    return { data: result.recordset || [] };
}

async function applyLeaveRequestRepo(req) {
    const userCode = req.user?.user_code || req.user?.emp_code;
    const db = req.tenantDB;
    const request = db.request();

    const {
        leave_type_id,
        from_date,
        to_date,
        total_days,
        is_half_day = false,
        half_day_session = null,
        reason,
        contact_number = null,
        address_during_leave = null,
        handover_notes = null,
        is_urgent = false
    } = req.body || {};

    if (!leave_type_id || !from_date || !to_date || !reason) {
        throw new Error("Missing required leave request fields: leave_type_id, from_date, to_date, and reason are required.");
    }

    const requestCode = `LR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    request.input("request_code", sql.VarChar, requestCode);
    request.input("emp_code", sql.VarChar, userCode);
    request.input("leave_type_id", sql.Int, parseInt(leave_type_id, 10));
    request.input("from_date", sql.Date, from_date);
    request.input("to_date", sql.Date, to_date);
    request.input("total_days", sql.Decimal(5, 2), parseFloat(total_days || 1));
    request.input("is_half_day", sql.Bit, is_half_day ? 1 : 0);
    request.input("half_day_session", sql.VarChar, half_day_session);
    request.input("reason", sql.VarChar, reason);
    request.input("contact_number", sql.VarChar, contact_number);
    request.input("address_during_leave", sql.VarChar, address_during_leave);
    request.input("handover_notes", sql.VarChar, handover_notes);
    request.input("is_urgent", sql.Bit, is_urgent ? 1 : 0);
    request.input("status", sql.VarChar, "Pending");
    request.input("created_by", sql.VarChar, userCode);

    const query = `
        INSERT INTO tbl_leave_request (
            request_code, emp_code, leave_type_id, from_date, to_date, total_days,
            is_half_day, half_day_session, reason, contact_number, address_during_leave,
            handover_notes, is_urgent, status, applied_on, created_by, created_date
        )
        VALUES (
            @request_code, @emp_code, @leave_type_id, @from_date, @to_date, @total_days,
            @is_half_day, @half_day_session, @reason, @contact_number, @address_during_leave,
            @handover_notes, @is_urgent, @status, CAST(GETDATE() AS DATE), @created_by, GETDATE()
        );
    `;

    await request.query(query);

    return {
        success: true,
        message: "Leave request submitted successfully",
        request_code: requestCode
    };
}

async function cancelLeaveRequestRepo(req) {
    const userCode = req.user?.user_code || req.user?.emp_code;
    const { id } = req.body || {};
    const db = req.tenantDB;
    const request = db.request();

    if (!id) {
        throw new Error("Request ID is required to cancel leave request.");
    }

    request.input("id", sql.Int, parseInt(id, 10));
    request.input("emp_code", sql.VarChar, userCode);
    request.input("status", sql.VarChar, "Cancelled");

    const query = `
        UPDATE tbl_leave_request
        SET status = @status, updated_date = GETDATE()
        WHERE id = @id AND emp_code = @emp_code AND (status = 'Pending' OR status = 'pending');
    `;

    await request.query(query);

    return {
        success: true,
        message: "Leave request cancelled successfully"
    };
}

module.exports = {
    getUserWorkScheduleRepo,
    getMyLeaveRequestsRepo,
    applyLeaveRequestRepo,
    cancelLeaveRequestRepo
};
