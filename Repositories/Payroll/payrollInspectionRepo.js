const sql = require("mssql");

async function getLopAttendanceInspectionRepo(req) {
    const db = req.tenantDB;
    const month = parseInt(req.query?.month || (new Date().getMonth() + 1));
    const year = parseInt(req.query?.year || new Date().getFullYear());

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const daysInMonth = endDate.getDate();

    let calculationBasis = 'calendar_days';
    try {
        const genRes = await db.request().query(`
            SELECT TOP 1 calculation_basis FROM tbl_payrollsettings_general WHERE is_active = 1
        `);
        if (genRes.recordset && genRes.recordset.length > 0) {
            calculationBasis = genRes.recordset[0].calculation_basis || 'calendar_days';
        }
    } catch (err) {
        console.log("Settings query note in inspection:", err.message);
    }

    let workingDays = daysInMonth;
    if (calculationBasis === 'exclude_sundays') {
        let sundays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            if (new Date(year, month - 1, d).getDay() === 0) sundays++;
        }
        workingDays = daysInMonth - sundays;
    }

    const checkAttReq = db.request();
    checkAttReq.input("start_date", sql.Date, startDate);
    checkAttReq.input("end_date", sql.Date, endDate);
    const checkAtt = await checkAttReq.query(`
        SELECT COUNT(*) AS total_punches 
        FROM tbl_attendance 
        WHERE attendance_date >= @start_date AND attendance_date <= @end_date
    `);
    const hasAnyAttendance = (checkAtt.recordset[0]?.total_punches || 0) > 0;

   const empRes = await db.request().query(`
        SELECT 
            e.id,
            e.emp_code,
            CONCAT(e.first_name, ' ', ISNULL(e.last_name, '')) AS emp_name,
            e.designation_code,
            e.department_code,
            d.depart_name AS department,
            des.desig_name AS designation
        FROM tbl_employee_mst e
        LEFT JOIN tbl_department_mst d ON e.department_code = d.depart_code
        LEFT JOIN tbl_designation_mst des ON e.designation_code = des.desig_code
        WHERE e.is_active = 1
        ORDER BY e.emp_code ASC
    `);

    const employees = empRes.recordset || [];
    const inspectionList = [];

    for (const emp of employees) {
        // Check salary structure mapping
        const salReq = db.request();
        salReq.input("target_code", sql.VarChar, emp.emp_code);
        salReq.input("desig_code", sql.VarChar, emp.designation_code || '');
        salReq.input("start_date", sql.Date, startDate);
        salReq.input("end_date", sql.Date, endDate);

        const salResult = await salReq.query(`
            SELECT TOP 1
                a.structure_id,
                s.structure_name,
                (
                    SELECT 
                        c.component_code,
                        sc.fixed_amount,
                        ct.payroll_impact
                    FROM tbl_salary_structure_components sc
                    LEFT JOIN tbl_salary_components c ON c.id = sc.component_id
                    LEFT JOIN tbl_salary_component_type ct ON ct.type_code = c.type_code
                    WHERE sc.structure_id = a.structure_id
                    ORDER BY sc.component_order ASC
                    FOR JSON PATH
                ) AS components
            FROM tbl_salary_structure_assignment a
            INNER JOIN tbl_salary_structure s ON s.id = a.structure_id AND s.status = 1
            WHERE (
                (a.assignment_type = 'employee' AND a.target_code = @target_code)
                OR
                (a.assignment_type = 'designation' AND a.target_code = @desig_code)
            )
            AND a.status = 1
            AND a.effective_date <= @end_date
            AND (a.end_date IS NULL OR a.end_date >= @start_date)
            ORDER BY CASE WHEN a.assignment_type = 'employee' THEN 1 ELSE 2 END, a.id DESC
        `);

        // Skip unmapped staff from active payroll LOP inspection
        if (!salResult.recordset || salResult.recordset.length === 0) {
            continue;
        }

        let comps = [];
        try {
            comps = JSON.parse(salResult.recordset[0].components || '[]');
        } catch {
            comps = [];
        }

        const baseGross = comps
            .filter(c => c.payroll_impact === 'add')
            .reduce((sum, c) => sum + (parseFloat(c.fixed_amount) || 0), 0);

        // Fetch attendance punches for this employee in month
        const attReq = db.request();
        attReq.input("emp_code", sql.VarChar, emp.emp_code);
        attReq.input("start_date", sql.Date, startDate);
        attReq.input("end_date", sql.Date, endDate);

        const attRes = await attReq.query(`
            SELECT 
                COUNT(*) AS punch_records,
                ISNULL(SUM(CASE 
                    WHEN LOWER(status) IN ('half-day', 'half day') THEN 0.5
                    WHEN LOWER(status) IN ('present', 'work_from_home', 'wfh') THEN 1.0
                    ELSE 0.0
                END), 0) AS present_count,
                ISNULL(SUM(CASE WHEN LOWER(status) IN ('half-day', 'half day') THEN 1 ELSE 0 END), 0) AS half_days,
                ISNULL(SUM(CASE WHEN LOWER(status) IN ('absent', 'unapproved') THEN 1 ELSE 0 END), 0) AS absent_days
            FROM tbl_attendance
            WHERE emp_code = @emp_code 
              AND attendance_date >= @start_date 
              AND attendance_date <= @end_date
        `);

        // Fetch approved leaves
        const leaveReq = db.request();
        leaveReq.input("emp_code", sql.VarChar, emp.emp_code);
        leaveReq.input("start_date", sql.Date, startDate);
        leaveReq.input("end_date", sql.Date, endDate);

        const leaveRes = await leaveReq.query(`
            SELECT ISNULL(SUM(total_days), 0) AS leave_days
            FROM tbl_leave_request
            WHERE emp_code = @emp_code 
              AND LOWER(status) = 'approved'
              AND from_date <= @end_date 
              AND to_date >= @start_date
        `);

        // Fetch daily attendance logs
        const dailyReq = db.request();
        dailyReq.input("emp_code", sql.VarChar, emp.emp_code);
        dailyReq.input("start_date", sql.Date, startDate);
        dailyReq.input("end_date", sql.Date, endDate);

        const dailyRes = await dailyReq.query(`
            SELECT 
                FORMAT(attendance_date, 'yyyy-MM-dd') AS attendance_date,
                CONVERT(VARCHAR(8), punch_in_time, 108) AS punch_in,
                CONVERT(VARCHAR(8), punch_out_time, 108) AS punch_out,
                LOWER(status) AS status,
                remarks
            FROM tbl_attendance
            WHERE emp_code = @emp_code 
              AND attendance_date >= @start_date 
              AND attendance_date <= @end_date
            ORDER BY attendance_date ASC
        `);

        const punchRecords = parseFloat(attRes.recordset[0]?.punch_records ?? 0);
        const presentDays = parseFloat(attRes.recordset[0]?.present_count ?? 0);
        const halfDays = parseInt(attRes.recordset[0]?.half_days ?? 0);
        const paidLeaves = parseFloat(leaveRes.recordset[0]?.leave_days ?? 0);

        let lopDays = 0;
        let finalPresent = presentDays;

        if (hasAnyAttendance) {
            if (punchRecords > 0 || paidLeaves > 0) {
                lopDays = Math.max(0, workingDays - (presentDays + paidLeaves));
            } else {
                lopDays = workingDays;
                finalPresent = 0;
            }
        } else {
            lopDays = 0;
            finalPresent = workingDays;
        }

        const perDaySalary = workingDays > 0 ? (baseGross / workingDays) : 0;
        const lopDeduction = Math.round(perDaySalary * lopDays);

        inspectionList.push({
            id: emp.emp_code,
            emp_code: emp.emp_code,
            name: emp.emp_name,
            department: emp.department || 'General',
            designation: emp.designation || 'Staff',
            structure_name: salResult.recordset[0].structure_name,
            base_gross: baseGross,
            working_days: workingDays,
            present_days: finalPresent,
            half_days: halfDays,
            paid_leaves: paidLeaves,
            lop_days: lopDays,
            per_day_rate: Math.round(perDaySalary),
            lop_deduction: lopDeduction,
            has_attendance_logs: punchRecords > 0,
            attendance_logs: dailyRes.recordset || []
        });
    }

    return {
        month,
        year,
        working_days: workingDays,
        calculation_basis: calculationBasis,
        has_attendance_logged: hasAnyAttendance,
        total_employees: inspectionList.length,
        total_lop_staff: inspectionList.filter(e => e.lop_days > 0).length,
        total_lop_days: inspectionList.reduce((sum, e) => sum + e.lop_days, 0),
        total_lop_deductions: inspectionList.reduce((sum, e) => sum + e.lop_deduction, 0),
        records: inspectionList
    };
}

// 2. Inspect Overtime & Variable Pay Breakdown
async function getOvertimeInspectionRepo(req) {
    const db = req.tenantDB;
    const month = parseInt(req.query?.month || (new Date().getMonth() + 1));
    const year = parseInt(req.query?.year || new Date().getFullYear());

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Query employees with overtime recorded
    const otReq = db.request();
    otReq.input("start_date", sql.Date, startDate);
    otReq.input("end_date", sql.Date, endDate);

    const otRes = await otReq.query(`
        SELECT 
            a.emp_code,
            CONCAT(e.first_name, ' ', ISNULL(e.last_name, '')) AS emp_name,
            d.depart_name AS department,
            des.desig_name AS designation,
            ISNULL(SUM(a.overtime_minutes), 0) AS total_ot_minutes,
            COUNT(CASE WHEN a.overtime_minutes > 0 THEN 1 END) AS ot_days_count,
            ISNULL(ws.overtime_applicable, 1) AS overtime_applicable,
            ISNULL(ws.overtime_rate, 1.5) AS overtime_rate
        FROM tbl_attendance a
        INNER JOIN tbl_employee_mst e ON a.emp_code = e.emp_code
        LEFT JOIN tbl_department_mst d ON e.department_code = d.depart_code
        LEFT JOIN tbl_designation_mst des ON e.designation_code = des.desig_code
        LEFT JOIN tbl_payroll_employee_work_schedules ws ON ws.user_code = e.emp_code
        WHERE a.attendance_date >= @start_date 
          AND a.attendance_date <= @end_date
          AND a.overtime_minutes > 0
          AND e.is_active = 1
        GROUP BY a.emp_code, e.first_name, e.last_name, d.depart_name, des.desig_name, ws.overtime_applicable, ws.overtime_rate
        ORDER BY a.emp_code ASC
    `);

    const records = [];
    const workingDays = endDate.getDate();

    for (const row of (otRes.recordset || [])) {
        // Query base salary from structure to compute hourly wage
        const salReq = db.request();
        salReq.input("target_code", sql.VarChar, row.emp_code);
        salReq.input("start_date", sql.Date, startDate);
        salReq.input("end_date", sql.Date, endDate);

        const salRes = await salReq.query(`
            SELECT TOP 1
                (
                    SELECT sc.fixed_amount
                    FROM tbl_salary_structure_components sc
                    LEFT JOIN tbl_salary_components c ON c.id = sc.component_id
                    LEFT JOIN tbl_salary_component_type ct ON ct.type_code = c.type_code
                    WHERE sc.structure_id = a.structure_id AND ct.payroll_impact = 'add'
                    FOR JSON PATH
                ) AS components
            FROM tbl_salary_structure_assignment a
            WHERE (a.target_code = @target_code)
              AND a.status = 1
              AND a.effective_date <= @end_date
              AND (a.end_date IS NULL OR a.end_date >= @start_date)
            ORDER BY a.id DESC
        `);

        let baseGross = 25000;
        if (salRes.recordset && salRes.recordset.length > 0) {
            try {
                const comps = JSON.parse(salRes.recordset[0].components || '[]');
                baseGross = comps.reduce((sum, c) => sum + (parseFloat(c.fixed_amount) || 0), 0) || 25000;
            } catch {
                baseGross = 25000;
            }
        }

        const otHours = Math.round((row.total_ot_minutes / 60) * 10) / 10;
        const hourlyRate = (baseGross / (workingDays * 8));
        const otRate = parseFloat(row.overtime_rate) || 1.5;
        const otPayout = Math.round(otHours * hourlyRate * otRate);

        // Fetch daily logs for this employee
        const logReq = db.request();
        logReq.input("emp_code", sql.VarChar, row.emp_code);
        logReq.input("start_date", sql.Date, startDate);
        logReq.input("end_date", sql.Date, endDate);

        const logRes = await logReq.query(`
            SELECT 
                FORMAT(attendance_date, 'yyyy-MM-dd') AS attendance_date,
                overtime_minutes,
                ROUND(CAST(overtime_minutes AS FLOAT) / 60, 2) AS overtime_hours,
                CONVERT(VARCHAR(8), punch_in_time, 108) AS punch_in,
                CONVERT(VARCHAR(8), punch_out_time, 108) AS punch_out,
                remarks
            FROM tbl_attendance
            WHERE emp_code = @emp_code 
              AND attendance_date >= @start_date 
              AND attendance_date <= @end_date
              AND overtime_minutes > 0
            ORDER BY attendance_date ASC
        `);

        records.push({
            id: row.emp_code,
            emp_code: row.emp_code,
            name: row.emp_name,
            department: row.department || 'General',
            designation: row.designation || 'Staff',
            total_ot_minutes: row.total_ot_minutes,
            overtime_hours: otHours,
            ot_days_count: row.ot_days_count,
            overtime_rate: otRate,
            hourly_rate: Math.round(hourlyRate),
            overtime_pay: otPayout,
            variable_bonus: 0,
            daily_logs: logRes.recordset || []
        });
    }

    return {
        month,
        year,
        total_ot_staff: records.length,
        total_ot_hours: records.reduce((sum, r) => sum + r.overtime_hours, 0),
        total_ot_payout: records.reduce((sum, r) => sum + r.overtime_pay, 0),
        records
    };
}

// 3. Inspect Salary Advances & Active Deductions
async function getAdvanceInspectionRepo(req) {
    const db = req.tenantDB;
    const month = parseInt(req.query?.month || (new Date().getMonth() + 1));
    const year = parseInt(req.query?.year || new Date().getFullYear());

    const advRes = await db.request().query(`
        SELECT 
            sar.id,
            sar.request_code,
            sar.emp_code,
            CONCAT(e.first_name, ' ', ISNULL(e.last_name, '')) AS emp_name,
            d.depart_name AS department,
            des.desig_name AS designation,
            sar.advance_amount,
            sar.monthly_deduction,
            sar.remaining_balance,
            ISNULL(sar.recovered_amount, sar.advance_amount - sar.remaining_balance) AS recovered_amount,
            sar.repayment_tenure,
            sar.reason,
            sar.status,
            FORMAT(sar.disbursement_date, 'yyyy-MM-dd') AS disbursement_date,
            FORMAT(sar.created_at, 'yyyy-MM-dd') AS created_date
        FROM tbl_salary_advance_request sar
        INNER JOIN tbl_employee_mst e ON sar.emp_code = e.emp_code
        LEFT JOIN tbl_department_mst d ON e.department_code = d.depart_code
        LEFT JOIN tbl_designation_mst des ON e.designation_code = des.desig_code
        WHERE LOWER(sar.status) IN ('approved', 'disbursed')
          AND sar.remaining_balance > 0
        ORDER BY sar.id DESC
    `);

    const records = (advRes.recordset || []).map(row => {
        const monthlyInstallment = Math.min(parseFloat(row.remaining_balance || 0), parseFloat(row.monthly_deduction || 0));
        return {
            id: row.emp_code,
            request_id: row.id,
            emp_code: row.emp_code,
            name: row.emp_name,
            department: row.department || 'General',
            designation: row.designation || 'Staff',
            advance_code: row.request_code || `ADV-${row.id}`,
            total_advance: parseFloat(row.advance_amount || 0),
            monthly_deduction: monthlyInstallment,
            remaining_balance: parseFloat(row.remaining_balance || 0),
            recovered_amount: parseFloat(row.recovered_amount || 0),
            purpose: row.reason || 'General Advance',
            disbursed_date: row.disbursement_date || row.created_date || '',
            status: row.status
        };
    });

    return {
        month,
        year,
        total_advances_count: records.length,
        total_monthly_recovery: records.reduce((sum, r) => sum + r.monthly_deduction, 0),
        total_remaining_balance: records.reduce((sum, r) => sum + r.remaining_balance, 0),
        records
    };
}

module.exports = {
    getLopAttendanceInspectionRepo,
    getOvertimeInspectionRepo,
    getAdvanceInspectionRepo
};
