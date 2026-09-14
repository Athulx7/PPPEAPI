const sql = require("mssql");

async function getLeaveAnalyticsDataRepo(req) {
    const userCode = req.user?.user_code || req.user?.emp_code;
    const db = req.tenantDB;
    const request = db.request();

    const { year } = req.query || {};
    const targetYear = parseInt(year || new Date().getFullYear(), 10);

    request.input("emp_code", sql.VarChar, userCode);
    request.input("year", sql.Int, targetYear);

    // 1. Fetch leave balances and allocation summary
    const balanceQuery = `
        SELECT
            lsa.id,
            lt.id AS leave_type_id,
            lt.LeaveTypeCode AS leave_code,
            lt.LeaveTypeName AS leave_name,
            lsa.allocated_days AS total,
            ISNULL((
                SELECT SUM(total_days)
                FROM tbl_leave_request lr
                WHERE lr.emp_code = lsa.emp_code
                  AND lr.leave_type_id = lsa.leave_type_id
                  AND lr.status = 'Approved'
            ), 0) AS used,
            ISNULL((
                SELECT SUM(total_days)
                FROM tbl_leave_request lr
                WHERE lr.emp_code = lsa.emp_code
                  AND lr.leave_type_id = lsa.leave_type_id
                  AND lr.status = 'Pending'
            ), 0) AS pending,
            (lsa.allocated_days - 
                ISNULL((SELECT SUM(total_days) FROM tbl_leave_request lr WHERE lr.emp_code = lsa.emp_code AND lr.leave_type_id = lsa.leave_type_id AND lr.status = 'Approved'), 0) - 
                ISNULL((SELECT SUM(total_days) FROM tbl_leave_request lr WHERE lr.emp_code = lsa.emp_code AND lr.leave_type_id = lsa.leave_type_id AND lr.status = 'Pending'), 0)
            ) AS available,
            ISNULL(lsa.carry_forward_days, 0) AS carry_forward
        FROM tbl_leave_settings_allocation lsa
        INNER JOIN tbl_leave_type lt ON lt.id = lsa.leave_type_id
        WHERE lsa.emp_code = @emp_code AND lsa.is_active = 1
        ORDER BY lt.LeaveTypeName;
    `;

    const balanceRes = await request.query(balanceQuery);
    const leaveBalance = balanceRes.recordset || [];

    // 2. Fetch monthly trend for approved leaves in requested year
    const trendQuery = `
        SELECT 
            MONTH(lr.from_date) AS month_num,
            ISNULL(SUM(lr.total_days), 0) AS total_days_taken
        FROM tbl_leave_request lr
        WHERE lr.emp_code = @emp_code
          AND lr.status = 'Approved'
          AND YEAR(lr.from_date) = @year
        GROUP BY MONTH(lr.from_date);
    `;

    const trendRes = await request.query(trendQuery);
    const trendRecords = trendRes.recordset || [];

    const monthlyLeaves = Array(12).fill(0);
    trendRecords.forEach(r => {
        const m = r.month_num - 1;
        if (m >= 0 && m < 12) {
            monthlyLeaves[m] = Number(r.total_days_taken || 0);
        }
    });

    // 3. Compute statistics
    const totalLeaves = leaveBalance.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const totalUsed = leaveBalance.reduce((sum, item) => sum + (Number(item.used) || 0), 0);
    const totalPending = leaveBalance.reduce((sum, item) => sum + (Number(item.pending) || 0), 0);
    const totalAvailable = leaveBalance.reduce((sum, item) => sum + (Number(item.available) || 0), 0);

    const utilizationRate = totalLeaves > 0 ? ((totalUsed / totalLeaves) * 100).toFixed(1) : "0.0";
    const averagePerMonth = (totalUsed / 12).toFixed(1);

    const mostUsed = leaveBalance.length > 0
        ? leaveBalance.reduce((max, item) => ((item.used || 0) > (max?.used || 0) ? item : max), leaveBalance[0])
        : null;

    const leastUsed = leaveBalance.length > 0
        ? leaveBalance.reduce((min, item) => ((item.used || 0) < (min?.used || 0) ? item : min), leaveBalance[0])
        : null;

    return {
        leaveStats: {
            totalLeaves,
            totalUsed,
            totalPending,
            totalAvailable,
            utilizationRate,
            monthlyLeaves,
            averagePerMonth,
            mostUsedLeave: mostUsed,
            leastUsedLeave: leastUsed
        },
        leaveBalance
    };
}

module.exports = { getLeaveAnalyticsDataRepo };
