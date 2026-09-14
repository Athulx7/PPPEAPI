const sql = require("mssql");

// Helper to calculate component values from salary structure
function calculateStructureComponents(components = []) {
    const values = {};

    // Fixed amounts first
    components.forEach(c => {
        if (!c.formula_expression && !c.percentage_value) {
            values[c.component_code] = parseFloat(c.fixed_amount) || 0;
        }
    });

    // Percentage based
    components.forEach(c => {
        if (c.percentage_value && c.base_component_code) {
            const base = values[c.base_component_code] || 0;
            values[c.component_code] = (parseFloat(c.percentage_value) / 100) * base;
        }
    });

    // Formula based
    components.forEach(c => {
        if (c.formula_expression) {
            let formula = c.formula_expression;
            Object.keys(values).forEach(code => {
                formula = formula.replace(new RegExp(`\\b${code}\\b`, 'g'), values[code]);
            });
            try {
                // eslint-disable-next-line no-eval
                values[c.component_code] = eval(formula);
            } catch {
                values[c.component_code] = 0;
            }
        }
    });

    const earnings = [];
    const deductions = [];
    const employerContributions = [];

    components.forEach(c => {
        const val = Math.round((values[c.component_code] || 0) * 100) / 100;
        const item = {
            component_code: c.component_code,
            component_name: c.component_name || c.component_code,
            amount: val,
            payroll_impact: c.payroll_impact
        };

        if (c.payroll_impact === 'add') {
            earnings.push(item);
        } else if (c.payroll_impact === 'sub') {
            deductions.push(item);
        } else if (c.payroll_impact === 'employer') {
            employerContributions.push(item);
        }
    });

    return { values, earnings, deductions, employerContributions };
}

// Get Auto-Run configuration from tbl_payrollsettings_general
async function getAutoRunConfigRepo(req) {
    const db = req.tenantDB;
    try {
        const res = await db.request().query(`
            SELECT TOP 1 
                payroll_frequency,
                calculation_basis,
                processing_day,
                enable_auto_payroll
            FROM tbl_payrollsettings_general
            WHERE is_active = 1
        `);

        if (res.recordset && res.recordset.length > 0) {
            const row = res.recordset[0];
            const processingDay = parseInt(row.processing_day) || 28;
            return {
                enabled: !!row.enable_auto_payroll,
                scheduled_day: processingDay,
                cutoff_day: Math.max(1, processingDay - 3),
                calculation_basis: row.calculation_basis || 'calendar_days',
                payroll_frequency: row.payroll_frequency || 'monthly'
            };
        }
    } catch (err) {
        console.error("Error querying tbl_payrollsettings_general in getAutoRunConfigRepo:", err.message);
    }

    return {
        enabled: true,
        scheduled_day: 28,
        cutoff_day: 25,
        calculation_basis: 'calendar_days',
        payroll_frequency: 'monthly'
    };
}

// Get Preflight Checks & preview employee payroll calculations
async function getPreflightChecksRepo(req) {
    const db = req.tenantDB;

    // Parse month & year (handles 1-12)
    let month = parseInt(req.query?.month || (new Date().getMonth() + 1));
    const year = parseInt(req.query?.year || new Date().getFullYear());

    if (month < 1 || month > 12) {
        month = new Date().getMonth() + 1;
    }

    // Safeguard: Check if requested period is in the future
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const isFuturePeriod = year > currentYear || (year === currentYear && month > currentMonth);

    if (isFuturePeriod) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        return {
            employees: [],
            unmapped_employees: [],
            metrics: {
                total_salary: 0,
                total_lop_deductions: 0,
                total_overtime_pay: 0,
                total_deductions: 0,
                net_payable: 0,
                employer_contribution: 0,
                lopEmployeeCount: 0,
                totalLopDays: 0,
                otEmployeeCount: 0,
                totalOtHours: 0,
                advanceCount: 0,
                totalAdvances: 0,
                pfCount: 0,
                esiCount: 0,
                totalStatutory: 0,
                activeCount: 0,
                holdCount: 0,
                unmappedCount: 0
            },
            feature_flags: {
                overtime_enabled: false,
                advances_enabled: false
            },
            period: {
                month,
                year,
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                total_working_days: endDate.getDate(),
                has_attendance_data: false,
                is_future_period: true
            },
            is_future_period: true,
            message: "Future payroll runs are disabled. Period attendance and biometric logs are not yet finalized."
        };
    }

    // Fetch payroll settings
    let calculationBasis = 'calendar_days';
    try {
        const genRes = await db.request().query(`
            SELECT TOP 1 calculation_basis, processing_day, enable_auto_payroll
            FROM tbl_payrollsettings_general
            WHERE is_active = 1
        `);
        if (genRes.recordset && genRes.recordset.length > 0) {
            calculationBasis = genRes.recordset[0].calculation_basis || 'calendar_days';
        }
    } catch (err) {
        console.log("Note querying tbl_payrollsettings_general:", err.message);
    }

    // Determine period dates
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // last day of month
    const daysInMonth = endDate.getDate();

    let totalWorkingDays = daysInMonth;
    if (calculationBasis === 'working_days') {
        let count = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const dt = new Date(year, month - 1, d);
            if (dt.getDay() !== 0) { // Exclude Sundays
                count++;
            }
        }
        totalWorkingDays = count;
    }

    // Check if attendance logs exist for this period across the tenant
    const attCheckReq = db.request();
    attCheckReq.input("start_date", sql.Date, startDate);
    attCheckReq.input("end_date", sql.Date, endDate);
    const attCheckRes = await attCheckReq.query(`
        SELECT COUNT(*) AS total_logs
        FROM tbl_attendance
        WHERE attendance_date >= @start_date AND attendance_date <= @end_date
    `);
    const hasAnyAttendanceInMonth = (attCheckRes.recordset[0]?.total_logs || 0) > 0;

    // Fetch active employees with department & designation names
    const empRes = await db.request().query(`
        SELECT 
            e.id,
            e.emp_code,
            e.first_name,
            e.last_name,
            e.joining_date,
            e.designation_code,
            e.department_code,
            e.state,
            d.depart_name AS department_name,
            des.desig_name AS designation_name
        FROM tbl_employee_mst e
        LEFT JOIN tbl_department_mst d ON e.department_code = d.depart_code
        LEFT JOIN tbl_designation_mst des ON e.designation_code = des.desig_code
        WHERE e.is_active = 1
        ORDER BY e.emp_code ASC
    `);

    const allEmployees = empRes.recordset || [];
    const mappedEmployees = [];
    const unmappedEmployees = [];

    for (const emp of allEmployees) {
        // Look up active salary structure assignment:
        // Priority 1: Direct employee assignment (status = 1, valid date range)
        // Priority 2: Designation assignment (status = 1, valid date range)
        const salReq = db.request();
        salReq.input("target_code", sql.VarChar, emp.emp_code);
        salReq.input("desig_code", sql.VarChar, emp.designation_code || '');
        salReq.input("start_date", sql.Date, startDate);
        salReq.input("end_date", sql.Date, endDate);

        const salResult = await salReq.query(`
            SELECT TOP 1
                a.id AS assignment_id,
                a.assignment_type,
                a.structure_id,
                s.structure_code,
                s.structure_name,
                (
                    SELECT 
                        c.component_code,
                        c.component_name,
                        sc.fixed_amount,
                        sc.percentage_value,
                        sc.formula_expression,
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

        let componentsList = [];
        let structureInfo = null;

        if (salResult.recordset && salResult.recordset.length > 0) {
            structureInfo = salResult.recordset[0];
            try {
                componentsList = JSON.parse(structureInfo.components || '[]');
            } catch (e) {
                componentsList = [];
            }
        }

        // If employee does NOT have a valid active salary structure mapped, record as unmapped and EXCLUDE from calculation
        if (!structureInfo || componentsList.length === 0) {
            unmappedEmployees.push({
                id: emp.emp_code,
                name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
                department: emp.department_name || 'Unassigned',
                designation: emp.designation_name || 'Unassigned',
                reason: !emp.designation_code ? 'No designation & no salary structure mapped' : 'No active salary structure assigned'
            });
            continue;
        }

        // Calculate base salary components
        const parsedStructure = calculateStructureComponents(componentsList);
        const calculatedEarnings = parsedStructure.earnings;
        const calculatedDeductions = parsedStructure.deductions;
        const employerComponents = parsedStructure.employerContributions;

        const baseGross = calculatedEarnings.reduce((sum, item) => sum + item.amount, 0);
        let basicSalaryComponent = calculatedEarnings.find(item => item.component_code === 'BASIC')?.amount || 0;
        if (basicSalaryComponent === 0) basicSalaryComponent = Math.round(baseGross * 0.5);

        // Attendance & LOP
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
                ISNULL(SUM(overtime_minutes), 0) AS total_overtime_minutes
            FROM tbl_attendance
            WHERE emp_code = @emp_code 
              AND attendance_date >= @start_date 
              AND attendance_date <= @end_date
        `);

        // Paid Leaves from tbl_leave_request
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

        const punchRecords = parseFloat(attRes.recordset[0]?.punch_records ?? 0);
        const presentDays = parseFloat(attRes.recordset[0]?.present_count ?? 0);
        const totalOtMinutes = parseFloat(attRes.recordset[0]?.total_overtime_minutes ?? 0);
        const paidLeaves = parseFloat(leaveRes.recordset[0]?.leave_days ?? 0);

        let finalPresentDays = presentDays;
        let unpaidLopDays = 0;

        if (hasAnyAttendanceInMonth) {
            // When attendance records exist in the system for this month
            if (punchRecords > 0 || paidLeaves > 0) {
                unpaidLopDays = Math.max(0, totalWorkingDays - (presentDays + paidLeaves));
            } else {
                // If company has attendance logs for this month but this employee has none
                unpaidLopDays = totalWorkingDays;
                finalPresentDays = 0;
            }
        } else {
            // If no attendance has been logged yet for the month, default to full attendance (0 LOP)
            finalPresentDays = totalWorkingDays;
            unpaidLopDays = 0;
        }

        const perDaySalary = totalWorkingDays > 0 ? (baseGross / totalWorkingDays) : 0;
        const lopDeduction = Math.round(perDaySalary * unpaidLopDays);

        // Overtime Calculation
        const overtimeHours = Math.round((totalOtMinutes / 60) * 10) / 10;
        const hourlyRate = (baseGross / 30 / 8) * 1.5;
        const overtimePay = Math.round(hourlyRate * overtimeHours);

        // Salary Advance Recovery Integration
        const advReq = db.request();
        advReq.input("emp_code", sql.VarChar, emp.emp_code);
        const advRes = await advReq.query(`
            SELECT TOP 1
                id,
                request_code,
                monthly_deduction,
                remaining_balance
            FROM tbl_salary_advance_request
            WHERE emp_code = @emp_code 
              AND LOWER(status) IN ('approved', 'disbursed') 
              AND remaining_balance > 0
            ORDER BY id ASC
        `);

        let advanceRecovery = 0;
        if (advRes.recordset && advRes.recordset.length > 0) {
            const advRow = advRes.recordset[0];
            const monthlyDeduction = parseFloat(advRow.monthly_deduction || 0);
            const remainingBalance = parseFloat(advRow.remaining_balance || 0);
            advanceRecovery = Math.min(monthlyDeduction, remainingBalance);
        }

        // Pro-rate base basic for statutory calculations
        const lopFactor = totalWorkingDays > 0 ? Math.max(0, (totalWorkingDays - unpaidLopDays) / totalWorkingDays) : 1;
        const proRatedGross = Math.max(0, baseGross - lopDeduction);
        const proRatedBasic = Math.round(basicSalaryComponent * lopFactor);

        // Statutory Deductions
        // 1. Professional Tax (PT)
        let ptDeduction = 0;
        if (baseGross > 20000) ptDeduction = 200;
        else if (baseGross > 15000) ptDeduction = 150;

        // 2. Provident Fund (PF): 12% basic
        let pfDeduction = Math.min(1800, Math.round(proRatedBasic * 0.12));
        const structurePf = calculatedDeductions.find(d => d.component_code === 'PF' || d.component_code === 'PFEMP');
        if (structurePf) {
            pfDeduction = Math.round(structurePf.amount * lopFactor);
        }

        // 3. ESI: 0.75% gross if gross <= 21000
        const esiDeduction = baseGross <= 21000 ? Math.ceil(proRatedGross * 0.0075) : 0;
        const employerEsi = baseGross <= 21000 ? Math.ceil(proRatedGross * 0.0325) : 0;

        // 4. TDS
        const tdsDeduction = 0;

        // Total Deductions & Net Pay
        const otherStructureDeductions = calculatedDeductions
            .filter(d => !['PF', 'PFEMP', 'ESI', 'PT'].includes(d.component_code))
            .reduce((sum, d) => sum + Math.round(d.amount * lopFactor), 0);

        const totalDeductions = lopDeduction + pfDeduction + esiDeduction + ptDeduction + tdsDeduction + advanceRecovery + otherStructureDeductions;
        const totalEarnings = baseGross + overtimePay;
        const netPay = Math.max(0, totalEarnings - totalDeductions);

        // Employer Totals
        let employerPf = pfDeduction;
        const structureEmployerPf = employerComponents.find(c => c.component_code === 'PFEMPLR');
        if (structureEmployerPf) {
            employerPf = Math.round(structureEmployerPf.amount * lopFactor);
        }
        const employerGratuity = Math.floor(proRatedBasic * 0.0417);
        const employerTotal = employerPf + employerEsi + employerGratuity;

        // Component breakdown for detail modal
        const proRatedEarnings = calculatedEarnings.map(item => ({
            ...item,
            amount: Math.round(item.amount * lopFactor)
        }));

        const finalDeductionsBreakdown = [
            { component_code: 'LOP', component_name: 'Loss of Pay (LOP)', amount: lopDeduction, payroll_impact: 'sub' },
            { component_code: 'PF', component_name: 'Provident Fund (PF)', amount: pfDeduction, payroll_impact: 'sub' },
            { component_code: 'ESI', component_name: 'Employee State Insurance (ESI)', amount: esiDeduction, payroll_impact: 'sub' },
            { component_code: 'PT', component_name: 'Professional Tax (PT)', amount: ptDeduction, payroll_impact: 'sub' }
        ];

        if (advanceRecovery > 0) {
            finalDeductionsBreakdown.push({
                component_code: 'ADVANCE',
                component_name: 'Salary Advance Recovery',
                amount: advanceRecovery,
                payroll_impact: 'sub'
            });
        }

        mappedEmployees.push({
            id: emp.emp_code,
            name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
            department: emp.department_name || 'General',
            designation: emp.designation_name || 'Employee',
            location: emp.state || 'Headquarters',
            status: 'active',
            selected: true,
            structure_id: structureInfo.structure_id,
            structure_name: structureInfo.structure_name,

            working_days: totalWorkingDays,
            present_days: finalPresentDays,
            leave_days: paidLeaves,
            lop_days: unpaidLopDays,
            lop_deduction: lopDeduction,

            gross_salary: baseGross,
            basic: proRatedBasic,
            hra: proRatedEarnings.find(e => e.component_code === 'HRA')?.amount || 0,
            special: proRatedEarnings.find(e => e.component_code === 'SPECIAL')?.amount || 0,
            conveyance: proRatedEarnings.find(e => e.component_code === 'CONVEYANCE')?.amount || 0,
            medical: proRatedEarnings.find(e => e.component_code === 'MEDICAL')?.amount || 0,
            variable_pay: 0,

            overtime_hours: overtimeHours,
            overtime_pay: overtimePay,

            pf: pfDeduction,
            esi: esiDeduction,
            professional_tax: ptDeduction,
            tds: tdsDeduction,
            advance_recovery: advanceRecovery,
            loan_recovery: 0,
            total_deductions: totalDeductions,

            net_pay: netPay,

            employer_pf: employerPf,
            employer_esi: employerEsi,
            employer_gratuity: employerGratuity,
            employer_total: employerTotal,

            earnings_breakdown: proRatedEarnings,
            deductions_breakdown: finalDeductionsBreakdown
        });
    }

    // Compute Summary Metrics
    const selected = mappedEmployees.filter(e => e.selected);
    const metrics = {
        total_salary: selected.reduce((sum, e) => sum + e.gross_salary, 0),
        total_lop_deductions: selected.reduce((sum, e) => sum + e.lop_deduction, 0),
        total_overtime_pay: selected.reduce((sum, e) => sum + e.overtime_pay, 0),
        total_deductions: selected.reduce((sum, e) => sum + e.total_deductions, 0),
        net_payable: selected.reduce((sum, e) => sum + e.net_pay, 0),
        employer_contribution: selected.reduce((sum, e) => sum + e.employer_total, 0),

        lopEmployeeCount: selected.filter(e => e.lop_days > 0).length,
        totalLopDays: selected.reduce((sum, e) => sum + e.lop_days, 0),
        otEmployeeCount: selected.filter(e => e.overtime_hours > 0).length,
        totalOtHours: selected.reduce((sum, e) => sum + e.overtime_hours, 0),
        advanceCount: selected.filter(e => e.advance_recovery > 0).length,
        totalAdvances: selected.reduce((sum, e) => sum + e.advance_recovery, 0),
        pfCount: selected.filter(e => e.pf > 0).length,
        esiCount: selected.filter(e => e.esi > 0).length,
        totalStatutory: selected.reduce((sum, e) => sum + e.pf + e.esi + e.professional_tax + e.tds, 0),
        activeCount: selected.length,
        holdCount: mappedEmployees.filter(e => e.status === 'hold').length,
        unmappedCount: unmappedEmployees.length,
        working_days: totalWorkingDays,
        newJoinersCount: 0
    };

    // Determine feature flags based on payroll settings / schedules
    let overtimeEnabled = false;
    try {
        const otCheck = await db.request().query(`
            SELECT TOP 1 1 FROM tbl_payroll_employee_work_schedules WHERE overtime_applicable = 1
        `);
        if (otCheck.recordset && otCheck.recordset.length > 0) {
            overtimeEnabled = true;
        } else {
            overtimeEnabled = metrics.otEmployeeCount > 0;
        }
    } catch {
        overtimeEnabled = metrics.otEmployeeCount > 0;
    }

    let advancesEnabled = false;
    try {
        const advCheck = await db.request().query(`
            SELECT TOP 1 1 FROM tbl_salary_advance_request WHERE LOWER(status) IN ('approved', 'disbursed') AND remaining_balance > 0
        `);
        advancesEnabled = (advCheck.recordset && advCheck.recordset.length > 0) || (metrics.advanceCount > 0);
    } catch {
        advancesEnabled = metrics.advanceCount > 0;
    }

    return {
        employees: mappedEmployees,
        unmapped_employees: unmappedEmployees,
        metrics,
        feature_flags: {
            overtime_enabled: overtimeEnabled,
            advances_enabled: advancesEnabled
        },
        period: {
            month,
            year,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            total_working_days: totalWorkingDays,
            has_attendance_data: hasAnyAttendanceInMonth
        }
    };
}

// Main Payroll Generation / Execution Engine
async function generatePayrollForPeriodRepo(req, options = {}) {
    const db = req.tenantDB;
    const userCode = req.user?.emp_code || req.user?.user_code || req.user?.email || 'SYSTEM';

    const month = parseInt(options.month || req.body?.month || (new Date().getMonth() + 1));
    const year = parseInt(options.year || req.body?.year || new Date().getFullYear());
    const runType = options.run_type || req.body?.run_type || 'manual';
    const paymentDate = req.body?.payment_date || options.payment_date || new Date().toISOString().split('T')[0];

    if (month < 1 || month > 12) throw new Error("Invalid period month");
    if (year < 2000 || year > 2100) throw new Error("Invalid period year");

    // Server-side Safeguard: Disallow future payroll execution
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    if (year > currentYear || (year === currentYear && month > currentMonth)) {
        throw new Error(`Future payroll runs are disabled. Cannot execute payroll for period ${month}/${year} as it is in the future.`);
    }

    // Check if payroll run already exists for period
    const checkReq = db.request();
    checkReq.input("month", sql.Int, month);
    checkReq.input("year", sql.Int, year);
    const existingRun = await checkReq.query(`
        SELECT TOP 1 id, payroll_run_code, status 
        FROM tbl_payroll_run 
        WHERE period_month = @month AND period_year = @year AND status = 'completed'
    `);

    if (existingRun.recordset && existingRun.recordset.length > 0 && !req.body?.allow_override) {
        throw new Error(`Payroll for period ${month}/${year} has already been completed (${existingRun.recordset[0].payroll_run_code}).`);
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // If employee records with adjustments were passed from Frontend review:
    let employeesToProcess = [];
    if (Array.isArray(req.body?.employees) && req.body.employees.length > 0) {
        employeesToProcess = req.body.employees.filter(e => e.selected);
    } else {
        // Fallback: Run preflight checks to get mapped employees automatically
        const preview = await getPreflightChecksRepo({
            tenantDB: db,
            query: { month, year }
        });
        employeesToProcess = (preview.employees || []).filter(e => e.selected);
    }

    if (employeesToProcess.length === 0) {
        throw new Error("No eligible employees with active salary structures selected for this payroll run.");
    }

    const runCode = `RUN-${year}-${String(month).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

    // Create payroll run record
    const runReq = db.request();
    runReq.input("payroll_run_code", sql.VarChar, runCode);
    runReq.input("period_month", sql.Int, month);
    runReq.input("period_year", sql.Int, year);
    runReq.input("start_date", sql.Date, startDate);
    runReq.input("end_date", sql.Date, endDate);
    runReq.input("total_employees", sql.Int, employeesToProcess.length);
    runReq.input("total_gross_pay", sql.Decimal(18, 2), 0);
    runReq.input("total_deductions", sql.Decimal(18, 2), 0);
    runReq.input("total_net_pay", sql.Decimal(18, 2), 0);
    runReq.input("status", sql.VarChar, 'processing');
    runReq.input("run_type", sql.VarChar, runType);
    runReq.input("processed_by", sql.VarChar, userCode);

    const runResult = await runReq.query(`
        INSERT INTO tbl_payroll_run (
            payroll_run_code, period_month, period_year, start_date, end_date,
            total_employees, total_gross_pay, total_deductions, total_net_pay,
            status, run_type, processed_by
        )
        OUTPUT INSERTED.id
        VALUES (
            @payroll_run_code, @period_month, @period_year, @start_date, @end_date,
            @total_employees, @total_gross_pay, @total_deductions, @total_net_pay,
            @status, @run_type, @processed_by
        )
    `);

    const payrollRunId = runResult.recordset[0].id;

    let grandTotalGross = 0;
    let grandTotalDeductions = 0;
    let grandTotalNet = 0;

    for (const emp of employeesToProcess) {
        const payslipCode = `PS-${emp.id}-${year}${String(month).padStart(2, '0')}`;

        const grossAmt = parseFloat(emp.gross_salary || 0);
        const basicAmt = parseFloat(emp.basic || 0);
        const advanceDeduction = parseFloat(emp.advance_recovery || 0);
        const statutoryDeductions = parseFloat((emp.pf || 0) + (emp.esi || 0) + (emp.professional_tax || 0) + (emp.tds || 0));
        const lopDeduction = parseFloat(emp.lop_deduction || 0);
        const otherDeductions = parseFloat(emp.total_deductions || 0) - (statutoryDeductions + advanceDeduction + lopDeduction);
        const totalDeductions = parseFloat(emp.total_deductions || 0);
        const netPay = parseFloat(emp.net_pay || 0);

        const psReq = db.request();
        psReq.input("payroll_run_id", sql.Int, payrollRunId);
        psReq.input("payslip_code", sql.VarChar, payslipCode);
        psReq.input("emp_code", sql.VarChar, emp.id);
        psReq.input("period_month", sql.Int, month);
        psReq.input("period_year", sql.Int, year);
        psReq.input("working_days", sql.Int, emp.working_days || 30);
        psReq.input("present_days", sql.Decimal(5, 2), emp.present_days || 0);
        psReq.input("paid_leaves", sql.Decimal(5, 2), emp.leave_days || 0);
        psReq.input("unpaid_leaves_lop", sql.Decimal(5, 2), emp.lop_days || 0);
        psReq.input("basic_salary", sql.Decimal(18, 2), basicAmt);
        psReq.input("gross_earnings", sql.Decimal(18, 2), grossAmt);
        psReq.input("salary_advance_deduction", sql.Decimal(18, 2), advanceDeduction);
        psReq.input("statutory_deductions", sql.Decimal(18, 2), statutoryDeductions);
        psReq.input("other_deductions", sql.Decimal(18, 2), Math.max(0, otherDeductions));
        psReq.input("total_deductions", sql.Decimal(18, 2), totalDeductions);
        psReq.input("net_pay", sql.Decimal(18, 2), netPay);
        psReq.input("earnings_breakdown", sql.NVarChar, JSON.stringify(emp.earnings_breakdown || []));
        psReq.input("deductions_breakdown", sql.NVarChar, JSON.stringify(emp.deductions_breakdown || []));
        psReq.input("status", sql.VarChar, 'generated');

        await psReq.query(`
            INSERT INTO tbl_payslip (
                payroll_run_id, payslip_code, emp_code, period_month, period_year,
                working_days, present_days, paid_leaves, unpaid_leaves_lop, basic_salary,
                gross_earnings, salary_advance_deduction, statutory_deductions,
                other_deductions, total_deductions, net_pay, earnings_breakdown,
                deductions_breakdown, status
            ) VALUES (
                @payroll_run_id, @payslip_code, @emp_code, @period_month, @period_year,
                @working_days, @present_days, @paid_leaves, @unpaid_leaves_lop, @basic_salary,
                @gross_earnings, @salary_advance_deduction, @statutory_deductions,
                @other_deductions, @total_deductions, @net_pay, @earnings_breakdown,
                @deductions_breakdown, @status
            )
        `);

        // Update salary advance record if advance deduction was recovered
        if (advanceDeduction > 0) {
            const advUpdateReq = db.request();
            advUpdateReq.input("emp_code", sql.VarChar, emp.id);
            advUpdateReq.input("recovered_amt", sql.Decimal(18, 2), advanceDeduction);
            await advUpdateReq.query(`
                UPDATE tbl_salary_advance_request
                SET remaining_balance = CASE 
                        WHEN remaining_balance - @recovered_amt <= 0 THEN 0 
                        ELSE remaining_balance - @recovered_amt 
                    END,
                    status = CASE 
                        WHEN remaining_balance - @recovered_amt <= 0 THEN 'completed' 
                        ELSE 'disbursed' 
                    END,
                    updated_at = GETDATE()
                WHERE emp_code = @emp_code 
                  AND LOWER(status) IN ('approved', 'disbursed') 
                  AND remaining_balance > 0
            `);
        }

        grandTotalGross += grossAmt;
        grandTotalDeductions += totalDeductions;
        grandTotalNet += netPay;
    }

    // Update payroll run header to completed
    const updateRunReq = db.request();
    updateRunReq.input("id", sql.Int, payrollRunId);
    updateRunReq.input("total_employees", sql.Int, employeesToProcess.length);
    updateRunReq.input("total_gross_pay", sql.Decimal(18, 2), grandTotalGross);
    updateRunReq.input("total_deductions", sql.Decimal(18, 2), grandTotalDeductions);
    updateRunReq.input("total_net_pay", sql.Decimal(18, 2), grandTotalNet);
    updateRunReq.input("status", sql.VarChar, 'completed');

    await updateRunReq.query(`
        UPDATE tbl_payroll_run
        SET total_employees = @total_employees,
            total_gross_pay = @total_gross_pay,
            total_deductions = @total_deductions,
            total_net_pay = @total_net_pay,
            status = @status,
            updated_at = GETDATE()
        WHERE id = @id
    `);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const periodName = `${monthNames[month - 1]} ${year}`;

    return {
        run_id: runCode,
        payroll_run_id: payrollRunId,
        payroll_run_code: runCode,
        period: `${month}/${year}`,
        periodName,
        employee_count: employeesToProcess.length,
        total_employees: employeesToProcess.length,
        total_gross_pay: grandTotalGross,
        total_deductions: grandTotalDeductions,
        total_net: grandTotalNet,
        total_net_pay: grandTotalNet,
        payment_date: paymentDate,
        status: 'completed'
    };
}

// Get All Payroll Runs List
async function getPayrollRunsRepo(req) {
    const db = req.tenantDB;
    const result = await db.request().query(`
        SELECT 
            id,
            payroll_run_code,
            period_month,
            period_year,
            FORMAT(start_date, 'yyyy-MM-dd') AS start_date,
            FORMAT(end_date, 'yyyy-MM-dd') AS end_date,
            total_employees,
            total_gross_pay,
            total_deductions,
            total_net_pay,
            status,
            run_type,
            processed_by,
            FORMAT(created_at, 'yyyy-MM-dd HH:mm') AS created_at
        FROM tbl_payroll_run
        ORDER BY id DESC
    `);
    return result.recordset || [];
}

// Get Single Payroll Run Details with Payslips
async function getPayrollRunDetailsRepo(req) {
    const db = req.tenantDB;
    const runId = req.params?.runId;

    const runReq = db.request();
    runReq.input("id", sql.Int, parseInt(runId));
    const runRes = await runReq.query(`
        SELECT * FROM tbl_payroll_run WHERE id = @id
    `);

    if (!runRes.recordset || runRes.recordset.length === 0) {
        throw new Error("Payroll run not found");
    }

    const psReq = db.request();
    psReq.input("run_id", sql.Int, parseInt(runId));
    const psRes = await psReq.query(`
        SELECT 
            p.*,
            CONCAT(e.first_name, ' ', ISNULL(e.last_name, '')) AS emp_name,
            d.depart_name AS department,
            des.desig_name AS designation
        FROM tbl_payslip p
        LEFT JOIN tbl_employee_mst e ON e.emp_code = p.emp_code
        LEFT JOIN tbl_department_mst d ON e.department_code = d.depart_code
        LEFT JOIN tbl_designation_mst des ON e.designation_code = des.desig_code
        WHERE p.payroll_run_id = @run_id
        ORDER BY p.id ASC
    `);

    return {
        run: runRes.recordset[0],
        payslips: psRes.recordset || []
    };
}

// Get Single Payslip
async function getPayslipDetailsRepo(req) {
    const db = req.tenantDB;
    const payslipId = req.params?.payslipId;

    const psReq = db.request();
    psReq.input("id", sql.Int, parseInt(payslipId));
    const psRes = await psReq.query(`
        SELECT 
            p.*,
            CONCAT(e.first_name, ' ', ISNULL(e.last_name, '')) AS emp_name,
            e.bank_account_number,
            e.ifsc_code,
            e.pan_number,
            d.depart_name AS department,
            des.desig_name AS designation
        FROM tbl_payslip p
        LEFT JOIN tbl_employee_mst e ON e.emp_code = p.emp_code
        LEFT JOIN tbl_department_mst d ON e.department_code = d.depart_code
        LEFT JOIN tbl_designation_mst des ON e.designation_code = des.desig_code
        WHERE p.id = @id
    `);

    if (!psRes.recordset || psRes.recordset.length === 0) {
        throw new Error("Payslip not found");
    }

    const payslip = psRes.recordset[0];
    try {
        payslip.earnings_breakdown = JSON.parse(payslip.earnings_breakdown || '[]');
    } catch {
        payslip.earnings_breakdown = [];
    }
    try {
        payslip.deductions_breakdown = JSON.parse(payslip.deductions_breakdown || '[]');
    } catch {
        payslip.deductions_breakdown = [];
    }

    return payslip;
}

// Get Payslips List with Role-Based Access (own, team, all)
async function getPayslipsRepo(req) {
    const db = req.tenantDB;
    const userCode = req.user?.emp_code || req.user?.user_code || '';
    const userRole = (req.user?.role_code || 'EMPLOYEE').toUpperCase();
    const isPrivileged = ['ADMIN', 'HR', 'PAYROLL_MANAGER', 'MANAGER'].includes(userRole);

    const view = req.query?.view || (isPrivileged ? 'all' : 'own');
    const month = req.query?.month ? parseInt(req.query.month) : null;
    const year = req.query?.year ? parseInt(req.query.year) : null;
    const empCode = req.query?.emp_code || '';
    const department = req.query?.department || '';
    const designation = req.query?.designation || '';
    const search = req.query?.search || '';

    const psReq = db.request();
    const whereConditions = [];

    // Role-based security: Regular EMPLOYEE can ONLY see their own payslips
    if (!isPrivileged || view === 'own') {
        psReq.input("current_user_code", sql.VarChar, userCode);
        whereConditions.push("p.emp_code = @current_user_code");
    } else if (view === 'team' && userRole === 'MANAGER') {
        psReq.input("current_manager_code", sql.VarChar, userCode);
        whereConditions.push("(p.emp_code = @current_manager_code OR e.reporting_manager_code = @current_manager_code)");
    }

    if (empCode && isPrivileged && view !== 'own') {
        psReq.input("filter_emp_code", sql.VarChar, empCode);
        whereConditions.push("p.emp_code = @filter_emp_code");
    }

    if (month) {
        psReq.input("filter_month", sql.Int, month);
        whereConditions.push("p.period_month = @filter_month");
    }

    if (year) {
        psReq.input("filter_year", sql.Int, year);
        whereConditions.push("p.period_year = @filter_year");
    }

    if (department && isPrivileged && view !== 'own') {
        psReq.input("filter_department", sql.VarChar, department);
        whereConditions.push("(d.depart_name = @filter_department OR d.depart_code = @filter_department)");
    }

    if (designation && isPrivileged && view !== 'own') {
        psReq.input("filter_designation", sql.VarChar, designation);
        whereConditions.push("(des.desig_name = @filter_designation OR des.desig_code = @filter_designation)");
    }

    if (search) {
        psReq.input("filter_search", sql.VarChar, `%${search}%`);
        whereConditions.push("(p.emp_code LIKE @filter_search OR e.first_name LIKE @filter_search OR e.last_name LIKE @filter_search)");
    }

    const whereClause = whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

    const query = `
        SELECT 
            p.id,
            p.payroll_run_id,
            p.payslip_code,
            p.emp_code,
            p.period_month,
            p.period_year,
            p.working_days,
            p.present_days,
            p.paid_leaves,
            p.unpaid_leaves_lop,
            p.basic_salary,
            p.gross_earnings,
            p.salary_advance_deduction,
            p.statutory_deductions,
            p.other_deductions,
            p.total_deductions,
            p.net_pay,
            p.earnings_breakdown,
            p.deductions_breakdown,
            p.status,
            FORMAT(p.created_at, 'yyyy-MM-dd') AS generated_date,
            CONCAT(e.first_name, ' ', ISNULL(e.last_name, '')) AS emp_name,
            e.designation_code,
            e.department_code,
            e.bank_account_number AS bank_account,
            e.bank_name,
            e.ifsc_code AS ifsc,
            e.pan_number AS pan,
            FORMAT(e.joining_date, 'yyyy-MM-dd') AS doj,
            d.depart_name AS department,
            des.desig_name AS designation,
            e.reporting_manager_code
        FROM tbl_payslip p
        LEFT JOIN tbl_employee_mst e ON e.emp_code = p.emp_code
        LEFT JOIN tbl_department_mst d ON e.department_code = d.depart_code
        LEFT JOIN tbl_designation_mst des ON e.designation_code = des.desig_code
        ${whereClause}
        ORDER BY p.period_year DESC, p.period_month DESC, p.emp_code ASC
    `;

    const res = await psReq.query(query);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return (res.recordset || []).map(row => {
        const mIndex = (row.period_month || 1) - 1;
        const monthStr = String(row.period_month).padStart(2, '0');
        const monthName = monthNames[mIndex] || `Month ${row.period_month}`;

        let earningsList = [];
        let deductionsList = [];
        try { earningsList = JSON.parse(row.earnings_breakdown || '[]'); } catch { earningsList = []; }
        try { deductionsList = JSON.parse(row.deductions_breakdown || '[]'); } catch { deductionsList = []; }

        const basic = earningsList.find(e => e.component_code === 'BASIC')?.amount || row.basic_salary || 0;
        const hra = earningsList.find(e => e.component_code === 'HRA')?.amount || 0;
        const special = earningsList.find(e => e.component_code === 'SPECIAL')?.amount || 0;
        const conveyance = earningsList.find(e => e.component_code === 'CONVEYANCE')?.amount || 0;
        const medical = earningsList.find(e => e.component_code === 'MEDICAL')?.amount || 0;
        const lta = earningsList.find(e => e.component_code === 'LTA')?.amount || 0;
        const overtime = earningsList.find(e => e.component_code === 'OVERTIME')?.amount || 0;
        const bonus = earningsList.find(e => e.component_code === 'BONUS')?.amount || 0;

        const pf = deductionsList.find(d => ['PF', 'PFEMP'].includes(d.component_code))?.amount || 0;
        const pt = deductionsList.find(d => d.component_code === 'PT')?.amount || 0;
        const esi = deductionsList.find(d => d.component_code === 'ESI')?.amount || 0;
        const advance = deductionsList.find(d => ['ADVANCE', 'SALARY_ADVANCE'].includes(d.component_code))?.amount || row.salary_advance_deduction || 0;

        const employerPf = pf;
        const employerGratuity = Math.floor(basic * 0.0417);
        const employerEsi = row.gross_earnings <= 21000 ? Math.ceil(row.gross_earnings * 0.0325) : 0;

        return {
            id: row.id,
            payroll_run_id: row.payroll_run_id,
            payslip_code: row.payslip_code,
            emp_code: row.emp_code,
            emp_name: row.emp_name,
            designation: row.designation || row.designation_code || 'Employee',
            department: row.department || row.department_code || 'General',
            grade: row.designation || 'Standard',
            month: monthStr,
            month_name: monthName,
            year: row.period_year,
            generated_date: row.generated_date,
            payment_date: row.generated_date,
            status: row.status,

            bank_name: row.bank_name || 'Bank of Record',
            bank_account: row.bank_account || 'N/A',
            ifsc: row.ifsc || 'N/A',
            pan: row.pan || 'N/A',
            doj: row.doj || '',

            working_days: row.working_days,
            present_days: row.present_days,
            paid_leaves: row.paid_leaves,
            lop_days: row.unpaid_leaves_lop,

            earnings: {
                basic: basic,
                hra: hra,
                special_allowance: special,
                conveyance: conveyance,
                medical: medical,
                lta: lta,
                overtime: overtime,
                bonus: bonus,
                total_earnings: row.gross_earnings,
                breakdown: earningsList
            },

            deductions: {
                pf_employee: pf,
                professional_tax: pt,
                esi: esi,
                income_tax: 0,
                loan_recovery: advance,
                advance_recovery: advance,
                total_deductions: row.total_deductions,
                breakdown: deductionsList
            },

            employer_contributions: {
                pf_employer: employerPf,
                gratuity: employerGratuity,
                insurance: employerEsi
            },

            net_pay: row.net_pay
        };
    });
}

// Get CTC Report (Cost to Company) with Role-Based Access & Structure Mapping Enforcement
async function getCtcReportRepo(req) {
    const db = req.tenantDB;
    const userCode = req.user?.emp_code || req.user?.user_code || '';
    const userRole = (req.user?.role_code || 'EMPLOYEE').toUpperCase();
    const isPrivileged = ['ADMIN', 'HR', 'PAYROLL_MANAGER', 'MANAGER'].includes(userRole);

    const view = req.query?.view || (isPrivileged ? 'all' : 'own');
    const empCode = req.query?.emp_code || '';
    const department = req.query?.department || '';
    const designation = req.query?.designation || '';
    const search = req.query?.search || '';

    const empReq = db.request();
    const whereConditions = ["e.is_active = 1"];

    // Role-based filter: Regular EMPLOYEE can ONLY see their own CTC
    if (!isPrivileged || view === 'own') {
        empReq.input("current_user_code", sql.VarChar, userCode);
        whereConditions.push("e.emp_code = @current_user_code");
    } else if (view === 'team' && userRole === 'MANAGER') {
        empReq.input("current_manager_code", sql.VarChar, userCode);
        whereConditions.push("(e.emp_code = @current_manager_code OR e.reporting_manager_code = @current_manager_code)");
    }

    if (empCode && isPrivileged && view !== 'own') {
        empReq.input("filter_emp_code", sql.VarChar, empCode);
        whereConditions.push("e.emp_code = @filter_emp_code");
    }

    if (department && isPrivileged && view !== 'own') {
        empReq.input("filter_department", sql.VarChar, department);
        whereConditions.push("(d.depart_name = @filter_department OR d.depart_code = @filter_department)");
    }

    if (designation && isPrivileged && view !== 'own') {
        empReq.input("filter_designation", sql.VarChar, designation);
        whereConditions.push("(des.desig_name = @filter_designation OR des.desig_code = @filter_designation)");
    }

    if (search) {
        empReq.input("filter_search", sql.VarChar, `%${search}%`);
        whereConditions.push("(e.emp_code LIKE @filter_search OR e.first_name LIKE @filter_search OR e.last_name LIKE @filter_search)");
    }

    const whereClause = "WHERE " + whereConditions.join(" AND ");

    const empRes = await empReq.query(`
        SELECT 
            e.id,
            e.emp_code,
            CONCAT(e.first_name, ' ', ISNULL(e.last_name, '')) AS emp_name,
            e.joining_date,
            FORMAT(e.joining_date, 'yyyy-MM-dd') AS doj,
            e.designation_code,
            e.department_code,
            e.state,
            e.pan_number AS pan,
            e.bank_account_number AS bank_account,
            e.bank_name,
            e.ifsc_code AS ifsc,
            e.reporting_manager_code,
            d.depart_name AS department,
            des.desig_name AS designation
        FROM tbl_employee_mst e
        LEFT JOIN tbl_department_mst d ON e.department_code = d.depart_code
        LEFT JOIN tbl_designation_mst des ON e.designation_code = des.desig_code
        ${whereClause}
        ORDER BY e.emp_code ASC
    `);

    const employees = empRes.recordset || [];
    const ctcList = [];

    for (const emp of employees) {
        // Query active salary structure assignment:
        // Direct employee assignment takes precedence over designation assignment
        const salReq = db.request();
        salReq.input("target_code", sql.VarChar, emp.emp_code);
        salReq.input("desig_code", sql.VarChar, emp.designation_code || '');

        const salResult = await salReq.query(`
            SELECT TOP 1
                a.id AS assignment_id,
                a.structure_id,
                a.assignment_type,
                s.structure_code,
                s.structure_name,
                (
                    SELECT 
                        c.component_code,
                        c.component_name,
                        sc.fixed_amount,
                        sc.percentage_value,
                        sc.formula_expression,
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
            AND (a.end_date IS NULL OR a.end_date >= GETDATE())
            ORDER BY CASE WHEN a.assignment_type = 'employee' THEN 1 ELSE 2 END, a.id DESC
        `);

        // Requirement: "the ctc wanted only where the user is mapped to a structure"
        if (!salResult.recordset || salResult.recordset.length === 0) {
            continue; // Skip employees who have NO active salary structure!
        }

        let componentsList = [];
        try {
            componentsList = JSON.parse(salResult.recordset[0].components || '[]');
        } catch {
            componentsList = [];
        }

        if (componentsList.length === 0) {
            continue; // Skip if no components
        }

        const parsed = calculateStructureComponents(componentsList);
        const earnings = parsed.earnings;
        const deductions = [...parsed.deductions];
        const employerComps = [...parsed.employerContributions];

        const basicSalary = earnings.find(e => e.component_code === 'BASIC')?.amount || 0;
        const hra = earnings.find(e => e.component_code === 'HRA')?.amount || 0;
        const monthlyGross = earnings.reduce((sum, item) => sum + item.amount, 0);

        // Employee deductions from structure or statutory PF
        let pfEmployee = deductions.find(d => ['PF', 'PFEMP'].includes(d.component_code))?.amount || 0;
        if (pfEmployee === 0 && basicSalary > 0) {
            pfEmployee = Math.min(1800, Math.round(basicSalary * 0.12));
            deductions.push({
                component_code: 'PF',
                component_name: 'Provident Fund (PF)',
                amount: pfEmployee,
                payroll_impact: 'sub'
            });
        }

        // Employer contributions (part of CTC) from structure or statutory rules
        let pfEmployer = employerComps.find(c => c.component_code === 'PFEMPLR')?.amount || 0;
        if (pfEmployer === 0 && basicSalary > 0) {
            pfEmployer = Math.min(1800, Math.round(basicSalary * 0.12));
            employerComps.push({
                component_code: 'PFEMPLR',
                component_name: 'PF Employer (12%)',
                amount: pfEmployer,
                payroll_impact: 'employer'
            });
        }

        if (monthlyGross <= 21000 && !employerComps.some(c => c.component_code === 'ESI_EMPLR')) {
            const esiEmployer = Math.ceil(monthlyGross * 0.0325);
            if (esiEmployer > 0) {
                employerComps.push({
                    component_code: 'ESI_EMPLR',
                    component_name: 'ESI Employer (3.25%)',
                    amount: esiEmployer,
                    payroll_impact: 'employer'
                });
            }
        }

        if (!employerComps.some(c => c.component_code === 'GRATUITY') && basicSalary > 0) {
            const gratuity = Math.floor(basicSalary * 0.0417);
            if (gratuity > 0) {
                employerComps.push({
                    component_code: 'GRATUITY',
                    component_name: 'Gratuity (4.17%)',
                    amount: gratuity,
                    payroll_impact: 'employer'
                });
            }
        }

        const monthlyEmployerTotal = employerComps.reduce((sum, c) => sum + (c.amount || 0), 0);
        const monthlyCTC = monthlyGross + monthlyEmployerTotal;
        const annualCTC = monthlyCTC * 12;

        ctcList.push({
            emp_code: emp.emp_code,
            emp_name: emp.emp_name,
            designation: emp.designation || 'Employee',
            department: emp.department || 'General',
            grade: salResult.recordset[0].structure_name || 'Standard',
            doj: emp.doj || '2026-01-01',
            structure_code: salResult.recordset[0].structure_code,
            structure_name: salResult.recordset[0].structure_name,

            // Core values
            basic_salary: basicSalary,
            hra: hra,
            pf_employer: pfEmployer,
            pf_employee: pfEmployee,

            monthly_gross: monthlyGross,
            monthly_ctc: monthlyCTC,
            total_ctc: annualCTC,
            annual_gross: monthlyGross * 12,
            annual_ctc: annualCTC,

            components: componentsList,
            earnings_list: earnings,
            deductions_list: deductions,
            employer_contributions_list: employerComps
        });
    }

    return ctcList;
}

// Get Employee Self Service Payslips (own view)
async function getMyPayslipsRepo(req) {
    req.query = { ...(req.query || {}), view: 'own' };
    return getPayslipsRepo(req);
}

module.exports = {
    getAutoRunConfigRepo,
    getPreflightChecksRepo,
    generatePayrollForPeriodRepo,
    getPayrollRunsRepo,
    getPayrollRunDetailsRepo,
    getPayslipDetailsRepo,
    getMyPayslipsRepo,
    getPayslipsRepo,
    getCtcReportRepo
};
