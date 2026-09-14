const sql = require("mssql");

async function getLeaveHistoryDataRepo(req) {
    const userCode = req.user?.user_code || req.user?.emp_code;
    const db = req.tenantDB;
    const request = db.request();

    const { year, month, status } = req.query || {};

    request.input("emp_code", sql.VarChar, userCode);

    let whereClause = `WHERE lr.emp_code = @emp_code`;

    if (year) {
        request.input("year", sql.Int, parseInt(year, 10));
        whereClause += ` AND YEAR(lr.from_date) = @year`;
    }

    if (month) {
        request.input("month", sql.Int, parseInt(month, 10));
        whereClause += ` AND MONTH(lr.from_date) = @month`;
    }

    if (status && status !== 'all') {
        request.input("status", sql.VarChar, status);
        whereClause += ` AND LOWER(lr.status) = LOWER(@status)`;
    }

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
            lr.reason,
            lr.status,
            FORMAT(lr.applied_on, 'yyyy-MM-dd') AS applied_on,
            ISNULL(e.first_name + ' ' + ISNULL(e.last_name, ''), lr.approved_by) AS approved_by,
            FORMAT(lr.approved_on, 'yyyy-MM-dd HH:mm') AS approved_on,
            lr.comments,
            lr.contact_number
        FROM tbl_leave_request lr
        LEFT JOIN tbl_leave_type lt ON lt.id = lr.leave_type_id
        LEFT JOIN tbl_employee_mst e ON e.emp_code = lr.approved_by
        ${whereClause}
        ORDER BY lr.id DESC;
    `;

    const result = await request.query(query);
    return { data: result.recordset || [] };
}

module.exports = { getLeaveHistoryDataRepo };
