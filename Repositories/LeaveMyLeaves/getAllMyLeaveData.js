const sql = require("mssql");
async function getAllMyLeaveDataRepo(req, res) {
    const userCode = req.user.user_code
    const db = req.tenantDB
    const request = db.request();
    request.input("emp_code", sql.VarChar, userCode);
    const result = await request.query(` SELECT
    lsa.id,
    lt.id AS leave_type_id,
    lt.LeaveTypeCode,
    lt.LeaveTypeName,
    lsa.allocated_days,
    ISNULL((
        SELECT SUM(total_days)
        FROM tbl_leave_request lr
        WHERE
            lr.emp_code = lsa.emp_code
            AND lr.leave_type_id = lsa.leave_type_id
            AND lr.status='Approved'
    ),0) AS used_days,
    ISNULL((
        SELECT SUM(total_days)
        FROM tbl_leave_request lr
        WHERE
            lr.emp_code = lsa.emp_code
            AND lr.leave_type_id = lsa.leave_type_id
            AND lr.status='Pending'
    ),0) AS pending_days,
    ISNULL((
        SELECT SUM(total_days)
        FROM tbl_leave_request lr
        WHERE
            lr.emp_code = lsa.emp_code
            AND lr.leave_type_id = lsa.leave_type_id
            AND lr.status='Approved'
            AND lr.from_date > CAST(GETDATE() AS DATE)
    ),0) AS upcoming_days,
    ( lsa.allocated_days -
        ISNULL(( SELECT SUM(total_days) FROM tbl_leave_request lr WHERE
                lr.emp_code=lsa.emp_code AND lr.leave_type_id=lsa.leave_type_id
                AND lr.status='Approved'
        ),0) - ISNULL((  SELECT SUM(total_days) FROM tbl_leave_request lr WHERE
                lr.emp_code=lsa.emp_code AND lr.leave_type_id=lsa.leave_type_id AND lr.status='Pending'
        ),0)
    ) AS available_days,

    ISNULL(lsa.carry_forward_days,0) AS carry_forward_days,
    lsa.carry_forward_expiry,
    lsa.valid_from,
    lsa.valid_to,
    CASE
        WHEN lsa.allocated_days=0 THEN 0
        ELSE
        ROUND(
            (
                ISNULL((
                    SELECT SUM(total_days)
                    FROM tbl_leave_request lr
                    WHERE
                        lr.emp_code=lsa.emp_code
                        AND lr.leave_type_id=lsa.leave_type_id
                        AND lr.status='Approved'
                ),0)
                *100.0
            )/lsa.allocated_days,2)
    END AS utilization_percentage

FROM tbl_leave_settings_allocation lsa
INNER JOIN tbl_leave_type lt
ON lt.id=lsa.leave_type_id
WHERE
lsa.emp_code= @emp_code
AND lsa.is_active=1
ORDER BY lt.LeaveTypeName; `)
    return { data: result.recordset }
}

async function getHolidayOfEmployeeBranchWIseREPO(req, res) {
    const userCode = req.user?.user_code || req.user?.emp_code;
    const db = req.tenantDB;
    const request = db.request();
    request.input("emp_code", sql.VarChar, userCode);
    const result = await request.query(`
        SELECT DISTINCT
            hm.id,
            hm.holiday_code,
            hm.holiday_name,
            FORMAT(hm.holiday_date, 'yyyy-MM-dd') AS holiday_date,
            hm.holiday_type_code,
            hm.is_optional,
            hm.is_half_day,
            hm.half_day_session,
            hm.description
        FROM tbl_holiday_mst hm
        LEFT JOIN tbl_holiday_calendar_mst hc ON hc.calendar_code = hm.calendar_code
        LEFT JOIN tbl_branch_mst br ON br.holiday_calendar_code = hc.calendar_code
        LEFT JOIN tbl_employee_mst emp ON emp.branch_code = br.branch_code AND emp.emp_code = @emp_code
        WHERE hm.is_active = 1
        ORDER BY holiday_date
    `);
    return { data: result.recordset || [] };
}

module.exports = { getAllMyLeaveDataRepo, getHolidayOfEmployeeBranchWIseREPO }