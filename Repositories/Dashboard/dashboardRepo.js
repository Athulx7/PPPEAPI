const sql = require("mssql");

/**
 * Format currency numbers safely (e.g., 125000 -> "$125,000" or "$1.2M")
 */
function formatCurrency(val) {
    const num = parseFloat(val) || 0;
    if (num >= 1000000) {
        return `$${(num / 1000000).toFixed(1)}M`;
    }
    return `$${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/**
 * 1. Admin Dashboard Repository
 */
async function getAdminDashboardDataRepo(req) {
    const db = req.tenantDB;

    // Default structure matching frontend state
    const data = {
        metrics: {
            totalEmployees: { value: "0", change: "+0 this month", detail: "Active: 0 | Inactive: 0" },
            systemUsers: { value: "0", change: "Admin: 0 | HR: 0 | Payroll: 0", detail: "Active roles configured" },
            pendingApprovals: { value: "0", change: "0 urgent requests", detail: "HR: 0 | Payroll: 0" },
            totalPayroll: { value: "$0", change: "Latest Run", detail: "Monthly: $0" },
            systemHealth: { value: "100%", change: "Operational", detail: "Database Connected" },
            companySettings: { value: "Configured", change: "Master Data Active", detail: "Configurations: 0" }
        },
        userAccess: [],
        recentCtcUpdates: [],
        companySettings: [],
        salaryComponents: [],
        systemActivities: []
    };

    // 1.1 Total Employees
    try {
        const empRes = await db.request().query(`
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_count,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive_count,
                SUM(CASE WHEN joining_date >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1) THEN 1 ELSE 0 END) AS new_this_month
            FROM tbl_employee_mst;
        `);
        const row = empRes.recordset[0] || {};
        const total = row.total || 0;
        const active = row.active_count || 0;
        const inactive = row.inactive_count || 0;
        const newMonth = row.new_this_month || 0;

        data.metrics.totalEmployees = {
            value: total.toLocaleString(),
            change: `+${newMonth} this month`,
            detail: `Active: ${active} | Inactive: ${inactive}`
        };
    } catch (err) {
        console.error("Admin dashboard employees error:", err.message);
    }

    // 1.2 System Users & Role Breakdown
    try {
        const userRes = await db.request().query(`
            SELECT 
                UPPER(ISNULL(role_code, 'EMPLOYEE')) AS role_code,
                COUNT(*) AS count
            FROM tbl_user_info
            WHERE is_active = 1
            GROUP BY role_code;
        `);
        let totalUsers = 0;
        let adminCount = 0, hrCount = 0, payrollCount = 0;
        const roleMap = {};

        userRes.recordset.forEach(r => {
            totalUsers += r.count;
            roleMap[r.role_code] = r.count;
            if (r.role_code === 'ADMIN') adminCount = r.count;
            else if (r.role_code === 'HR') hrCount = r.count;
            else if (r.role_code === 'PAYROLL_MANAGER' || r.role_code === 'PAYROLL') payrollCount = r.count;
        });

        data.metrics.systemUsers = {
            value: totalUsers.toString(),
            change: `Admin: ${adminCount} | HR: ${hrCount} | Payroll: ${payrollCount}`,
            detail: "Active roles configured"
        };

        data.userAccess = [
            {
                name: "HR Manager",
                users: hrCount,
                permissions: ["Employee Management", "Leave Approval", "Attendance"],
                color: "bg-blue-100 text-blue-600"
            },
            {
                name: "Payroll Admin",
                users: payrollCount,
                permissions: ["Salary Processing", "Payslip Generation", "Tax Reports"],
                color: "bg-green-100 text-green-600"
            },
            {
                name: "Department Heads",
                users: roleMap['MANAGER'] || roleMap['DEPT_HEAD'] || 0,
                permissions: ["Team Management", "Leave Approval", "Reports"],
                color: "bg-purple-100 text-purple-600"
            },
            {
                name: "Super Admin",
                users: adminCount,
                permissions: ["Full System Access", "User Management", "Settings"],
                color: "bg-amber-100 text-amber-600"
            }
        ];
    } catch (err) {
        console.error("Admin dashboard user access error:", err.message);
    }

    // 1.3 Pending Approvals (Leaves + Advances)
    try {
        let pendingLeaves = 0;
        let pendingAdvances = 0;

        try {
            const leaveRes = await db.request().query(`
                SELECT COUNT(*) AS count 
                FROM tbl_leave_request 
                WHERE LOWER(status) = 'pending';
            `);
            pendingLeaves = leaveRes.recordset[0]?.count || 0;
        } catch (e) {}

        try {
            const advRes = await db.request().query(`
                SELECT COUNT(*) AS count 
                FROM tbl_salary_advance_request 
                WHERE LOWER(status) = 'pending';
            `);
            pendingAdvances = advRes.recordset[0]?.count || 0;
        } catch (e) {}

        const totalPending = pendingLeaves + pendingAdvances;
        data.metrics.pendingApprovals = {
            value: totalPending.toString(),
            change: `${pendingLeaves} leave, ${pendingAdvances} advance`,
            detail: `HR: ${pendingLeaves} | Payroll: ${pendingAdvances}`
        };
    } catch (err) {
        console.error("Admin dashboard pending approvals error:", err.message);
    }

    // 1.4 Total Payroll (Latest run)
    try {
        const runRes = await db.request().query(`
            SELECT TOP 1 
                total_net_pay,
                total_gross_pay,
                employee_count,
                month,
                year,
                status
            FROM tbl_payroll_run
            ORDER BY year DESC, month DESC;
        `);
        if (runRes.recordset.length > 0) {
            const latest = runRes.recordset[0];
            const net = parseFloat(latest.total_net_pay) || 0;
            const gross = parseFloat(latest.total_gross_pay) || 0;
            const empCnt = latest.employee_count || 0;

            data.metrics.totalPayroll = {
                value: formatCurrency(net),
                change: `Period: ${latest.month}/${latest.year} (${latest.status})`,
                detail: `Gross: ${formatCurrency(gross)} | Emps: ${empCnt}`
            };
        }
    } catch (err) {
        console.error("Admin dashboard payroll run error:", err.message);
    }

    // 1.5 Master Settings Summary
    try {
        let deptCount = 0, desigCount = 0, compCount = 0;
        try {
            const d = await db.request().query(`SELECT COUNT(*) AS c FROM tbl_department_mst WHERE is_active = 1;`);
            deptCount = d.recordset[0]?.c || 0;
        } catch (e) {}
        try {
            const ds = await db.request().query(`SELECT COUNT(*) AS c FROM tbl_designation_mst WHERE is_active = 1;`);
            desigCount = ds.recordset[0]?.c || 0;
        } catch (e) {}
        try {
            const sc = await db.request().query(`SELECT COUNT(*) AS c FROM tbl_salary_components;`);
            compCount = sc.recordset[0]?.c || 0;
        } catch (e) {}

        data.companySettings = [
            { category: "Departments", items: deptCount, lastUpdated: "Active", color: "bg-blue-100" },
            { category: "Designations", items: desigCount, lastUpdated: "Active", color: "bg-green-100" },
            { category: "Salary Components", items: compCount, lastUpdated: "Configured", color: "bg-purple-100" },
            { category: "Company Info", items: 1, lastUpdated: "Configured", color: "bg-amber-100" }
        ];
        data.metrics.companySettings = {
            value: "Configured",
            change: "All Masters Loaded",
            detail: `Configs: ${deptCount + desigCount + compCount}`
        };
    } catch (err) {
        console.error("Admin dashboard settings summary error:", err.message);
    }

    // 1.6 Recent CTC Updates (Employee Salary Structure Assignments)
    try {
        const ctcRes = await db.request().query(`
            SELECT TOP 5
                ISNULL(e.first_name + ' ' + ISNULL(e.last_name, ''), a.target_code) AS name,
                ISNULL(d.depart_name, 'General') AS department,
                ISNULL(s.structure_name, 'Standard Structure') AS structure_name,
                FORMAT(ISNULL(a.created_at, GETDATE()), 'yyyy-MM-dd') AS update_date
            FROM tbl_salary_structure_assignment a
            LEFT JOIN tbl_employee_mst e ON e.emp_code = a.target_code
            LEFT JOIN tbl_department_mst d ON d.depart_code = e.department_code
            LEFT JOIN tbl_salary_structure s ON s.id = a.structure_id
            WHERE a.assignment_type = 'employee'
            ORDER BY a.id DESC;
        `);

        if (ctcRes.recordset.length > 0) {
            data.recentCtcUpdates = ctcRes.recordset.map(r => ({
                name: r.name,
                department: r.department,
                oldCtc: r.structure_name,
                newCtc: "Assigned",
                change: "Active",
                date: r.update_date
            }));
        }
    } catch (err) {
        console.error("Admin dashboard ctc updates error:", err.message);
    }

    // 1.7 Salary Component Breakdown
    try {
        const compRes = await db.request().query(`
            SELECT 
                c.component_name,
                c.component_code,
                ISNULL(ct.type_name, 'Allowance') AS type_name,
                ISNULL(ct.payroll_impact, 'add') AS payroll_impact
            FROM tbl_salary_components c
            LEFT JOIN tbl_salary_component_type ct ON ct.type_code = c.type_code
            ORDER BY c.id ASC;
        `);
        if (compRes.recordset.length > 0) {
            const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-amber-500", "bg-red-500", "bg-indigo-500"];
            data.salaryComponents = compRes.recordset.slice(0, 5).map((c, i) => ({
                name: c.component_name,
                value: c.payroll_impact === 'sub' ? "Deduction" : "Earning",
                percentage: `${c.type_name}`,
                color: colors[i % colors.length]
            }));
        }
    } catch (err) {
        console.error("Admin dashboard salary components error:", err.message);
    }

    // 1.8 System Activities
    try {
        const actRes = await db.request().query(`
            SELECT TOP 4
                'New employee added' AS action,
                ISNULL(first_name + ' ' + ISNULL(last_name, ''), emp_code) AS person,
                department_code AS target,
                FORMAT(ISNULL(created_at, GETDATE()), 'yyyy-MM-dd') AS time
            FROM tbl_employee_mst
            ORDER BY id DESC;
        `);
        if (actRes.recordset.length > 0) {
            data.systemActivities = actRes.recordset.map(r => ({
                action: r.action,
                person: r.person,
                target: r.target || 'General',
                time: r.time
            }));
        }
    } catch (err) {
        console.error("Admin dashboard activities error:", err.message);
    }

    return data;
}

/**
 * 2. HR Dashboard Repository
 */
async function getHrDashboardDataRepo(req) {
    const db = req.tenantDB;

    const data = {
        metrics: {
            totalEmployees: { value: "0", change: "+0 this month", detail: "Active: 0 | On Leave: 0" },
            leaveRequests: { value: "0", change: "0 pending", detail: "Approved: 0 | Rejected: 0" },
            employeeMaster: { value: "0", change: "All up to date", detail: "Active records" },
            departments: { value: "0", change: "Active", detail: "Configured" },
            designations: { value: "0", change: "Active", detail: "Roles configured" },
            leaveTypes: { value: "0", change: "Policies", detail: "Leave types active" }
        },
        upcomingLeaves: [],
        pendingApprovals: [],
        recentEmployeeUpdates: [],
        departmentStats: [],
        leaveTypeStats: [],
        quickStats: []
    };

    // 2.1 Employees & Today's Leaves
    try {
        const empRes = await db.request().query(`
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_count,
                SUM(CASE WHEN joining_date >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1) THEN 1 ELSE 0 END) AS new_this_month
            FROM tbl_employee_mst;
        `);
        const total = empRes.recordset[0]?.total || 0;
        const active = empRes.recordset[0]?.active_count || 0;
        const newMonth = empRes.recordset[0]?.new_this_month || 0;

        let onLeaveToday = 0;
        try {
            const onLeaveRes = await db.request().query(`
                SELECT COUNT(DISTINCT emp_code) AS c 
                FROM tbl_leave_request 
                WHERE CAST(GETDATE() AS DATE) BETWEEN from_date AND to_date 
                  AND LOWER(status) = 'approved';
            `);
            onLeaveToday = onLeaveRes.recordset[0]?.c || 0;
        } catch (e) {}

        data.metrics.totalEmployees = {
            value: total.toString(),
            change: `+${newMonth} this month`,
            detail: `Active: ${active} | On Leave: ${onLeaveToday}`
        };
        data.metrics.employeeMaster = {
            value: active.toString(),
            change: "All up to date",
            detail: "Active employees"
        };
    } catch (err) {
        console.error("HR dashboard emp metrics error:", err.message);
    }

    // 2.2 Leave Requests Summary
    try {
        const lrRes = await db.request().query(`
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN LOWER(status) = 'approved' THEN 1 ELSE 0 END) AS approved_count,
                SUM(CASE WHEN LOWER(status) = 'rejected' THEN 1 ELSE 0 END) AS rejected_count
            FROM tbl_leave_request;
        `);
        const total = lrRes.recordset[0]?.total || 0;
        const pending = lrRes.recordset[0]?.pending_count || 0;
        const approved = lrRes.recordset[0]?.approved_count || 0;
        const rejected = lrRes.recordset[0]?.rejected_count || 0;

        data.metrics.leaveRequests = {
            value: total.toString(),
            change: `+${pending} pending`,
            detail: `Approved: ${approved} | Rejected: ${rejected}`
        };
    } catch (err) {
        console.error("HR dashboard leave metrics error:", err.message);
    }

    // 2.3 Departments, Designations, Leave Types counts
    try {
        let deptCount = 0, desigCount = 0, ltCount = 0;
        try {
            const d = await db.request().query(`SELECT COUNT(*) AS c FROM tbl_department_mst WHERE is_active = 1;`);
            deptCount = d.recordset[0]?.c || 0;
        } catch (e) {}
        try {
            const ds = await db.request().query(`SELECT COUNT(*) AS c FROM tbl_designation_mst WHERE is_active = 1;`);
            desigCount = ds.recordset[0]?.c || 0;
        } catch (e) {}
        try {
            const lt = await db.request().query(`SELECT COUNT(*) AS c FROM tbl_leave_type WHERE is_active = 1;`);
            ltCount = lt.recordset[0]?.c || 0;
        } catch (e) {}

        data.metrics.departments = { value: deptCount.toString(), change: "Active", detail: "Departments" };
        data.metrics.designations = { value: desigCount.toString(), change: "Active", detail: "Designations" };
        data.metrics.leaveTypes = { value: ltCount.toString(), change: "Policies", detail: "Configured types" };

        data.quickStats = [
            { label: "Active Departments", value: deptCount.toString() },
            { label: "Total Designations", value: desigCount.toString() },
            { label: "Leave Types", value: ltCount.toString() },
            { label: "Pending Approvals", value: data.metrics.leaveRequests.change.replace('+', '') },
            { label: "Total Employees", value: data.metrics.totalEmployees.value },
            { label: "This Month Joinees", value: data.metrics.totalEmployees.change.replace('+', '') }
        ];
    } catch (err) {
        console.error("HR dashboard masters error:", err.message);
    }

    // 2.4 Upcoming Leaves
    try {
        const upRes = await db.request().query(`
            SELECT TOP 5
                lr.id,
                ISNULL(e.first_name + ' ' + ISNULL(e.last_name, ''), lr.emp_code) AS name,
                ISNULL(d.depart_name, 'General') AS department,
                ISNULL(lt.LeaveTypeName, 'Leave') AS type,
                CONVERT(VARCHAR(10), lr.from_date, 120) + ' to ' + CONVERT(VARCHAR(10), lr.to_date, 120) AS dates,
                LOWER(lr.status) AS status,
                CAST(lr.total_days AS VARCHAR) + ' days' AS days
            FROM tbl_leave_request lr
            LEFT JOIN tbl_employee_mst e ON e.emp_code = lr.emp_code
            LEFT JOIN tbl_department_mst d ON d.depart_code = e.department_code
            LEFT JOIN tbl_leave_type lt ON lt.id = lr.leave_type_id
            ORDER BY lr.from_date DESC;
        `);
        data.upcomingLeaves = upRes.recordset || [];
    } catch (err) {
        console.error("HR dashboard upcoming leaves error:", err.message);
    }

    // 2.5 Pending Approvals
    try {
        const penRes = await db.request().query(`
            SELECT TOP 5
                lr.id,
                'Leave Request' AS type,
                ISNULL(e.first_name + ' ' + ISNULL(e.last_name, ''), lr.emp_code) AS employee,
                ISNULL(lt.LeaveTypeName, 'Leave') AS details,
                CAST(lr.total_days AS VARCHAR) + ' days' AS duration,
                CONVERT(VARCHAR(10), lr.from_date, 120) AS date,
                'pending' AS status,
                CASE WHEN lr.is_urgent = 1 THEN 'urgent' ELSE 'normal' END AS priority
            FROM tbl_leave_request lr
            LEFT JOIN tbl_employee_mst e ON e.emp_code = lr.emp_code
            LEFT JOIN tbl_leave_type lt ON lt.id = lr.leave_type_id
            WHERE LOWER(lr.status) = 'pending'
            ORDER BY lr.id DESC;
        `);
        data.pendingApprovals = penRes.recordset || [];
    } catch (err) {
        console.error("HR dashboard pending approvals error:", err.message);
    }

    // 2.6 Recent Employee Updates
    try {
        const recRes = await db.request().query(`
            SELECT TOP 4
                ISNULL(e.first_name + ' ' + ISNULL(e.last_name, ''), e.emp_code) AS name,
                'Employee Active' AS action,
                ISNULL(d.depart_name, 'General') AS department,
                FORMAT(ISNULL(e.created_at, GETDATE()), 'yyyy-MM-dd') AS date,
                FORMAT(ISNULL(e.created_at, GETDATE()), 'hh:mm tt') AS time
            FROM tbl_employee_mst e
            LEFT JOIN tbl_department_mst d ON d.depart_code = e.department_code
            ORDER BY e.id DESC;
        `);
        data.recentEmployeeUpdates = recRes.recordset || [];
    } catch (err) {
        console.error("HR dashboard recent employee updates error:", err.message);
    }

    // 2.7 Department Stats
    try {
        const deptStatRes = await db.request().query(`
            SELECT TOP 6
                ISNULL(d.depart_name, e.department_code) AS name,
                COUNT(*) AS employees
            FROM tbl_employee_mst e
            LEFT JOIN tbl_department_mst d ON d.depart_code = e.department_code
            WHERE e.is_active = 1
            GROUP BY d.depart_name, e.department_code
            ORDER BY employees DESC;
        `);
        const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-amber-500", "bg-indigo-500", "bg-red-500"];
        data.departmentStats = (deptStatRes.recordset || []).map((r, i) => ({
            name: r.name || 'Unassigned',
            employees: r.employees,
            color: colors[i % colors.length]
        }));
    } catch (err) {
        console.error("HR dashboard department stats error:", err.message);
    }

    // 2.8 Leave Type Stats
    try {
        const ltStatRes = await db.request().query(`
            SELECT TOP 6
                ISNULL(lt.LeaveTypeName, 'Other') AS type,
                COUNT(lr.id) AS count
            FROM tbl_leave_type lt
            LEFT JOIN tbl_leave_request lr ON lr.leave_type_id = lt.id
            GROUP BY lt.LeaveTypeName
            ORDER BY count DESC;
        `);
        const colors = ["bg-blue-500", "bg-green-500", "bg-amber-500", "bg-pink-500", "bg-indigo-500", "bg-red-500"];
        data.leaveTypeStats = (ltStatRes.recordset || []).map((r, i) => ({
            type: r.type,
            count: r.count,
            color: colors[i % colors.length]
        }));
    } catch (err) {
        console.error("HR dashboard leave type stats error:", err.message);
    }

    return data;
}

/**
 * 3. Payroll Manager Dashboard Repository
 */
async function getPayrollDashboardDataRepo(req) {
    const db = req.tenantDB;

    const data = {
        metrics: {
            thisMonthPayroll: { value: "$0", change: "No runs yet", detail: "For 0 employees" },
            pendingProcessing: { value: "0", change: "Claims & Advances", detail: "Requires attention" },
            lopDays: { value: "0", change: "0 days", detail: "Loss of pay days" },
            taxDeductions: { value: "$0", change: "Total Deductions", detail: "Latest run deductions" },
            overtimeHours: { value: "0 hrs", change: "+0 hrs", detail: "Overtime logged" },
            costPerEmployee: { value: "$0", change: "Monthly average", detail: "Average net salary" }
        },
        payrollRuns: [],
        dataUploadOptions: [],
        payrollLeaves: [],
        salaryAdvances: [],
        performanceData: [
            { metric: "Payroll Execution Rate", value: "100%", change: "On schedule", color: "bg-green-500" },
            { metric: "Employee Coverage", value: "100%", change: "All active", color: "bg-blue-500" },
            { metric: "Statutory Compliance", value: "Verified", change: "TDS / PF / ESI", color: "bg-purple-500" },
            { metric: "Data Sync Status", value: "Up to date", change: "Attendance & Leaves", color: "bg-amber-500" },
        ],
        salaryComponents: []
    };

    // 3.1 Payroll Runs History & Metrics
    try {
        const runRes = await db.request().query(`
            SELECT TOP 5
                id,
                month,
                year,
                status,
                total_net_pay,
                total_gross_pay,
                total_deductions,
                employee_count,
                FORMAT(ISNULL(processed_date, created_at), 'MMM dd, yyyy') AS processed_date
            FROM tbl_payroll_run
            ORDER BY year DESC, month DESC;
        `);

        if (runRes.recordset.length > 0) {
            const latest = runRes.recordset[0];
            const net = parseFloat(latest.total_net_pay) || 0;
            const gross = parseFloat(latest.total_gross_pay) || 0;
            const deductions = parseFloat(latest.total_deductions) || (gross - net);
            const empCount = latest.employee_count || 1;
            const costPerEmp = empCount > 0 ? (net / empCount) : 0;

            data.metrics.thisMonthPayroll = {
                value: formatCurrency(net),
                change: `Period: ${latest.month}/${latest.year}`,
                detail: `For ${empCount} employees`
            };

            data.metrics.taxDeductions = {
                value: formatCurrency(deductions),
                change: "Statutory & Tax",
                detail: `Gross: ${formatCurrency(gross)}`
            };

            data.metrics.costPerEmployee = {
                value: formatCurrency(costPerEmp),
                change: "Monthly average",
                detail: "Average take home"
            };

            const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            data.payrollRuns = runRes.recordset.map(r => ({
                month: `${monthNames[r.month] || r.month} ${r.year}`,
                status: r.status,
                amount: formatCurrency(r.total_net_pay),
                processed: r.status === 'completed' ? '100%' : '50%',
                employees: `${r.employee_count || 0}`,
                processedDate: r.processed_date,
                canRun: r.status !== 'completed'
            }));
        }
    } catch (err) {
        console.error("Payroll dashboard runs error:", err.message);
    }

    // 3.2 Pending Processing (Advances & Leaves)
    try {
        let pendingAdv = 0;
        let pendingLeaves = 0;

        try {
            const a = await db.request().query(`SELECT COUNT(*) AS c FROM tbl_salary_advance_request WHERE LOWER(status) = 'pending';`);
            pendingAdv = a.recordset[0]?.c || 0;
        } catch (e) {}

        try {
            const l = await db.request().query(`SELECT COUNT(*) AS c FROM tbl_leave_request WHERE LOWER(status) = 'pending';`);
            pendingLeaves = l.recordset[0]?.c || 0;
        } catch (e) {}

        data.metrics.pendingProcessing = {
            value: (pendingAdv + pendingLeaves).toString(),
            change: `${pendingAdv} Advances, ${pendingLeaves} Leaves`,
            detail: "Requires action before run"
        };
    } catch (err) {
        console.error("Payroll dashboard pending processing error:", err.message);
    }

    // 3.3 LOP Records
    try {
        const lopRes = await db.request().query(`
            SELECT 
                ISNULL(SUM(lr.total_days), 0) AS total_lop_days
            FROM tbl_leave_request lr
            LEFT JOIN tbl_leave_type lt ON lt.id = lr.leave_type_id
            WHERE LOWER(lt.LeaveTypeCode) LIKE '%lop%' OR LOWER(lt.LeaveTypeName) LIKE '%loss of pay%';
        `);
        const lopDays = lopRes.recordset[0]?.total_lop_days || 0;
        data.metrics.lopDays = {
            value: lopDays.toString(),
            change: "Across all employees",
            detail: "Unpaid leave days"
        };
    } catch (err) {
        console.error("Payroll dashboard lop error:", err.message);
    }

    // 3.4 Data Upload Options from Batches
    try {
        const batchRes = await db.request().query(`
            SELECT 
                upload_type,
                COUNT(*) AS total_batches,
                MAX(created_at) AS last_upload
            FROM tbl_data_upload_batches
            GROUP BY upload_type;
        `);
        const batchMap = {};
        batchRes.recordset.forEach(b => {
            batchMap[b.upload_type] = b;
        });

        data.dataUploadOptions = [
            {
                title: "Attendance Data",
                description: "Upload employee biometric & attendance logs",
                format: "CSV/Excel",
                status: batchMap['ATTENDANCE'] ? 'completed' : 'ready',
                records: batchMap['ATTENDANCE']?.total_batches || 0
            },
            {
                title: "LOP (Loss of Pay)",
                description: "Upload monthly LOP days for employees",
                format: "CSV/Excel",
                status: batchMap['LOP'] ? 'completed' : 'ready',
                records: batchMap['LOP']?.total_batches || 0
            },
            {
                title: "Overtime & Variable Pay",
                description: "Upload overtime hours and incentive data",
                format: "CSV/Excel",
                status: batchMap['OVERTIME'] ? 'completed' : 'ready',
                records: batchMap['OVERTIME']?.total_batches || 0
            },
            {
                title: "Salary Advance Deductions",
                description: "Upload loan recovery and advance deductions",
                format: "CSV/Excel",
                status: batchMap['ADVANCE'] ? 'completed' : 'ready',
                records: batchMap['ADVANCE']?.total_batches || 0
            }
        ];
    } catch (err) {
        console.error("Payroll dashboard uploads error:", err.message);
    }

    // 3.5 Payroll Leaves (LOP leaves)
    try {
        const plRes = await db.request().query(`
            SELECT TOP 4
                ISNULL(e.first_name + ' ' + ISNULL(e.last_name, ''), lr.emp_code) AS name,
                ISNULL(d.depart_name, 'General') AS department,
                ISNULL(lt.LeaveTypeName, 'LOP') AS leaveType,
                CAST(lr.total_days AS VARCHAR) AS days,
                CONVERT(VARCHAR(10), lr.from_date, 120) AS date,
                LOWER(lr.status) AS status
            FROM tbl_leave_request lr
            LEFT JOIN tbl_employee_mst e ON e.emp_code = lr.emp_code
            LEFT JOIN tbl_department_mst d ON d.depart_code = e.department_code
            LEFT JOIN tbl_leave_type lt ON lt.id = lr.leave_type_id
            WHERE LOWER(lt.LeaveTypeCode) LIKE '%lop%' OR LOWER(lt.LeaveTypeName) LIKE '%loss of pay%'
            ORDER BY lr.id DESC;
        `);
        data.payrollLeaves = plRes.recordset || [];
    } catch (err) {
        console.error("Payroll dashboard leaves error:", err.message);
    }

    // 3.6 Salary Advances
    try {
        const advRes = await db.request().query(`
            SELECT TOP 4
                ISNULL(e.first_name + ' ' + ISNULL(e.last_name, ''), a.emp_code) AS name,
                ISNULL(d.depart_name, 'General') AS department,
                format(a.advance_amount, 'C', 'en-US') AS amount,
                CONVERT(VARCHAR(10), a.created_at, 120) AS date,
                '$' + CAST(ISNULL(a.monthly_installment, 0) AS VARCHAR) + '/mo' AS repayment,
                LOWER(a.status) AS status,
                format(ISNULL(a.remaining_balance, a.advance_amount), 'C', 'en-US') AS remaining
            FROM tbl_salary_advance_request a
            LEFT JOIN tbl_employee_mst e ON e.emp_code = a.emp_code
            LEFT JOIN tbl_department_mst d ON d.depart_code = e.department_code
            ORDER BY a.id DESC;
        `);
        data.salaryAdvances = advRes.recordset || [];
    } catch (err) {
        console.error("Payroll dashboard advances error:", err.message);
    }

    // 3.7 Salary Component Breakdown
    try {
        const compRes = await db.request().query(`
            SELECT 
                c.component_name AS name,
                ISNULL(ct.type_name, 'Earnings') AS type_name,
                ISNULL(ct.payroll_impact, 'add') AS payroll_impact
            FROM tbl_salary_components c
            LEFT JOIN tbl_salary_component_type ct ON ct.type_code = c.type_code
            ORDER BY c.id ASC;
        `);
        const colors = ["bg-blue-500", "bg-green-500", "bg-amber-500", "bg-purple-500", "bg-red-500"];
        data.salaryComponents = (compRes.recordset || []).slice(0, 5).map((c, i) => ({
            name: c.name,
            value: c.payroll_impact === 'sub' ? "Deduction" : "Earning",
            percentage: c.type_name,
            color: colors[i % colors.length]
        }));
    } catch (err) {
        console.error("Payroll dashboard components error:", err.message);
    }

    return data;
}

/**
 * 4. Employee Dashboard Repository
 */
async function getEmployeeDashboardDataRepo(req) {
    const db = req.tenantDB;
    const userCode = req.user?.user_code || req.user?.emp_code;

    const data = {
        metrics: {
            leaveBalance: { value: "0 Days", subtitle: "Annual: 0 | Sick: 0 | Casual: 0", trend: "0 days added", trendColor: "text-green-600" },
            currentCtc: { value: "$0", subtitle: "Monthly: $0 | Annual", trend: "Active CTC", trendColor: "text-green-600" },
            pendingRequests: { value: "0", subtitle: "0 urgent approval", trend: "Awaiting review", trendColor: "text-amber-600" },
            documents: { value: "Verified", subtitle: "Profile Complete", trend: "Status: Active", trendColor: "text-emerald-600" }
        },
        leaveBreakdown: [],
        recentPayslips: [],
        ctcBreakdown: [],
        recentActivities: [],
        myRequests: []
    };

    if (!userCode) return data;

    // 4.1 Leave Balances
    try {
        const ltRes = await db.request()
            .input("emp_code", sql.VarChar, userCode)
            .query(`
                SELECT 
                    lt.LeaveTypeName AS type,
                    ISNULL(lt.DefaultDays, 12) AS allocated,
                    ISNULL((
                        SELECT SUM(lr.total_days) 
                        FROM tbl_leave_request lr 
                        WHERE lr.emp_code = @emp_code 
                          AND lr.leave_type_id = lt.id 
                          AND LOWER(lr.status) = 'approved'
                    ), 0) AS used
                FROM tbl_leave_type lt
                WHERE lt.is_active = 1;
            `);

        let totalAllocated = 0, totalUsed = 0, totalBalance = 0;
        const colors = ["bg-blue-500", "bg-green-500", "bg-amber-500", "bg-pink-500", "bg-indigo-500"];

        data.leaveBreakdown = (ltRes.recordset || []).map((r, i) => {
            const alloc = parseFloat(r.allocated) || 0;
            const used = parseFloat(r.used) || 0;
            const bal = Math.max(0, alloc - used);
            totalAllocated += alloc;
            totalUsed += used;
            totalBalance += bal;

            return {
                type: r.type,
                allocated: alloc,
                used: used,
                balance: bal,
                color: colors[i % colors.length]
            };
        });

        data.metrics.leaveBalance = {
            value: `${totalBalance} Days`,
            subtitle: `Allocated: ${totalAllocated} | Used: ${totalUsed}`,
            trend: `${totalBalance} days remaining`,
            trendColor: "text-green-600"
        };
    } catch (err) {
        console.error("Employee dashboard leave balance error:", err.message);
    }

    // 4.2 Current CTC & Structure Components
    try {
        const ctcRes = await db.request()
            .input("emp_code", sql.VarChar, userCode)
            .query(`
                SELECT TOP 1
                    s.id AS structure_id,
                    s.structure_name
                FROM tbl_salary_structure_assignment a
                INNER JOIN tbl_salary_structure s ON s.id = a.structure_id
                WHERE (a.assignment_type = 'employee' AND a.target_code = @emp_code)
                ORDER BY a.id DESC;
            `);

        if (ctcRes.recordset.length > 0) {
            const structId = ctcRes.recordset[0].structure_id;
            const compRes = await db.request()
                .input("structure_id", sql.Int, structId)
                .query(`
                    SELECT 
                        c.component_name,
                        c.component_code,
                        sc.fixed_amount,
                        sc.percentage_value,
                        ct.payroll_impact
                    FROM tbl_salary_structure_components sc
                    INNER JOIN tbl_salary_components c ON c.id = sc.component_id
                    LEFT JOIN tbl_salary_component_type ct ON ct.type_code = c.type_code
                    WHERE sc.structure_id = @structure_id;
                `);

            let monthlyTotal = 0;
            const colors = ["bg-blue-500", "bg-green-500", "bg-amber-500", "bg-purple-500", "bg-indigo-500"];
            const breakdown = [];

            compRes.recordset.forEach((c, idx) => {
                const amt = parseFloat(c.fixed_amount) || 0;
                if (c.payroll_impact === 'add') monthlyTotal += amt;
                breakdown.push({
                    component: c.component_name,
                    amount: formatCurrency(amt),
                    percentage: "Active",
                    color: colors[idx % colors.length]
                });
            });

            const annualCtc = monthlyTotal * 12;
            data.metrics.currentCtc = {
                value: formatCurrency(annualCtc),
                subtitle: `Monthly: ${formatCurrency(monthlyTotal)} | Annual`,
                trend: ctcRes.recordset[0].structure_name,
                trendColor: "text-green-600"
            };
            data.ctcBreakdown = breakdown;
        }
    } catch (err) {
        console.error("Employee dashboard ctc error:", err.message);
    }

    // 4.3 Pending Requests (Leaves + Advances)
    try {
        const reqRes = await db.request()
            .input("emp_code", sql.VarChar, userCode)
            .query(`
                SELECT COUNT(*) AS c 
                FROM tbl_leave_request 
                WHERE emp_code = @emp_code AND LOWER(status) = 'pending';
            `);
        const pendingCount = reqRes.recordset[0]?.c || 0;

        let advPending = 0;
        try {
            const aRes = await db.request()
                .input("emp_code", sql.VarChar, userCode)
                .query(`
                    SELECT COUNT(*) AS c 
                    FROM tbl_salary_advance_request 
                    WHERE emp_code = @emp_code AND LOWER(status) = 'pending';
                `);
            advPending = aRes.recordset[0]?.c || 0;
        } catch (e) {}

        const totalPending = pendingCount + advPending;
        data.metrics.pendingRequests = {
            value: totalPending.toString(),
            subtitle: `${pendingCount} Leave, ${advPending} Advance`,
            trend: "Awaiting review",
            trendColor: totalPending > 0 ? "text-amber-600" : "text-green-600"
        };
    } catch (err) {
        console.error("Employee dashboard pending requests error:", err.message);
    }

    // 4.4 Recent Payslips
    try {
        const psRes = await db.request()
            .input("emp_code", sql.VarChar, userCode)
            .query(`
                SELECT TOP 5
                    p.id,
                    p.month,
                    p.year,
                    p.gross_earnings,
                    p.net_take_home,
                    p.status
                FROM tbl_payslip p
                WHERE p.emp_code = @emp_code
                ORDER BY p.year DESC, p.month DESC;
            `);

        const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        data.recentPayslips = (psRes.recordset || []).map(r => ({
            id: r.id,
            month: `${monthNames[r.month] || r.month} ${r.year}`,
            gross: formatCurrency(r.gross_earnings),
            net: formatCurrency(r.net_take_home),
            status: r.status || 'paid',
            download: true
        }));
    } catch (err) {
        console.error("Employee dashboard recent payslips error:", err.message);
    }

    // 4.5 My Requests (Recent Leaves & Advances)
    try {
        const myReqRes = await db.request()
            .input("emp_code", sql.VarChar, userCode)
            .query(`
                SELECT TOP 5
                    lr.id,
                    ISNULL(lt.LeaveTypeName, 'Leave Request') AS type,
                    lr.status,
                    lr.reason AS details,
                    CONVERT(VARCHAR(10), lr.from_date, 120) + ' to ' + CONVERT(VARCHAR(10), lr.to_date, 120) AS date,
                    CAST(lr.total_days AS VARCHAR) + ' days' AS duration,
                    FORMAT(ISNULL(lr.applied_on, GETDATE()), 'MMM dd, yyyy') AS appliedOn
                FROM tbl_leave_request lr
                LEFT JOIN tbl_leave_type lt ON lt.id = lr.leave_type_id
                WHERE lr.emp_code = @emp_code
                ORDER BY lr.id DESC;
            `);
        data.myRequests = myReqRes.recordset || [];
    } catch (err) {
        console.error("Employee dashboard my requests error:", err.message);
    }

    // 4.6 Recent Activities
    try {
        const actRes = await db.request()
            .input("emp_code", sql.VarChar, userCode)
            .query(`
                SELECT TOP 4
                    'Leave request ' + LOWER(lr.status) AS action,
                    ISNULL(lt.LeaveTypeName, 'Leave') + ' (' + CAST(lr.total_days AS VARCHAR) + ' days)' AS details,
                    FORMAT(ISNULL(lr.applied_on, GETDATE()), 'yyyy-MM-dd') AS time,
                    LOWER(lr.status) AS status
                FROM tbl_leave_request lr
                LEFT JOIN tbl_leave_type lt ON lt.id = lr.leave_type_id
                WHERE lr.emp_code = @emp_code
                ORDER BY lr.id DESC;
            `);
        data.recentActivities = actRes.recordset || [];
    } catch (err) {
        console.error("Employee dashboard activities error:", err.message);
    }

    return data;
}

module.exports = {
    getAdminDashboardDataRepo,
    getHrDashboardDataRepo,
    getPayrollDashboardDataRepo,
    getEmployeeDashboardDataRepo
};
