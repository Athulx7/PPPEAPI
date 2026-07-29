const sql = require("mssql")


async function getWorkSchedulesRepo(req) {
    const db = req.tenantDB

    let departments = []
    try {
        const deptRes = await db.request().query(`
            SELECT depart_code AS value, depart_name AS label
            FROM tbl_department_mst
            WHERE is_active = 1
        `)
        departments = deptRes.recordset
    } catch (err) {
        console.log("Departments query note:", err.message)
    }

    let designations = []
    try {
        const desigRes = await db.request().query(`
            SELECT desig_code AS value, desig_name AS label, depart_code AS departmentCode
            FROM tbl_designation_mst
            WHERE is_active = 1
        `)
        designations = desigRes.recordset
    } catch (err) {
        console.log("Designations query note:", err.message)
    }

    let employees = []
    try {
        const empRes = await db.request().query(`
            SELECT  e.emp_code AS userCode, e.emp_code AS value,
                CONCAT(ISNULL(e.first_name, ''), ' ', ISNULL(e.last_name, '')) AS label,
                CONCAT(ISNULL(e.first_name, ''), ' ', ISNULL(e.last_name, '')) AS name,
                e.designation_code AS designationCode,
                e.department_code AS departmentCode,
                ISNULL(d.desig_name, '') AS designation,
                ISNULL(dp.depart_name, '') AS department
            FROM tbl_employee_mst e
            LEFT JOIN tbl_designation_mst d ON e.designation_code = d.desig_code
            LEFT JOIN tbl_department_mst dp ON e.department_code = dp.depart_code
            WHERE e.is_active = 1
        `)
        employees = empRes.recordset
    } catch (err) {
        console.log("Employees query note:", err.message)
    }

    let schedules = []
    try {
        const schedRes = await db.request().query(`
            SELECT  id, user_code AS userCode, employee_name AS employeeName,
                department, designation, target_type AS targetType,
                work_week AS workWeek, working_hours_per_day AS workingHoursPerDay,
                is_fixed_start_end AS isFixedStartEnd, start_time AS startTime,
                end_time AS endTime, overtime_applicable AS overtimeApplicable,
                overtime_rate AS overtimeRate, shift_allowance AS shiftAllowance,
                night_shift_allowance AS nightShiftAllowance, updated_at AS updatedAt
            FROM tbl_payroll_employee_work_schedules ORDER BY department, employee_name
        `)
        schedules = schedRes.recordset.map(s => ({
            ...s,
            workWeek: s.workWeek ? (typeof s.workWeek === 'string' ? JSON.parse(s.workWeek) : s.workWeek) : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            isFixedStartEnd: Boolean(s.isFixedStartEnd),
            overtimeApplicable: Boolean(s.overtimeApplicable)
        }))
    } catch (err) {
        console.log("Schedules query note:", err.message)
    }

    return { departments, designations, employees, schedules }
}

async function saveWorkScheduleRepo(req) {
    const db = req.tenantDB
    const { targetType, departmentCodes, employeeCodes, schedule } = req.body

    const workWeekJson = JSON.stringify(schedule.workWeek || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
    const workingHours = schedule.workingHoursPerDay || 9.0
    const isFixedStartEnd = schedule.isFixedStartEnd ? 1 : 0
    const startTime = schedule.startTime || '09:00'
    const endTime = schedule.endTime || '18:00'
    const overtimeApplicable = schedule.overtimeApplicable ? 1 : 0
    const overtimeRate = schedule.overtimeRate || 1.5
    const shiftAllowance = schedule.shiftAllowance || 0.0
    const nightShiftAllowance = schedule.nightShiftAllowance || 0.0

    let targetEmployees = []

    if (targetType === 'department') {
        if (!departmentCodes || departmentCodes.length === 0) {
            throw new Error("Please select at least one department")
        }
        const request = db.request()
        const params = departmentCodes.map((d, i) => {
            request.input(`dept${i}`, sql.VarChar, d)
            return `@dept${i}`
        })
        const empRes = await request.query(`
            SELECT e.emp_code AS user_code, CONCAT(ISNULL(e.first_name, ''), ' ', ISNULL(e.last_name, '')) AS emp_name, ISNULL(dp.depart_name, '') AS depart_name, ISNULL(d.desig_name, '') AS desig_name
            FROM tbl_employee_mst e
            LEFT JOIN tbl_designation_mst d ON e.designation_code = d.desig_code
            LEFT JOIN tbl_department_mst dp ON e.department_code = dp.depart_code
            WHERE e.department_code IN (${params.join(',')}) AND e.is_active = 1
        `)
        targetEmployees = empRes.recordset
    } else {
        if (!employeeCodes || employeeCodes.length === 0) {
            throw new Error("Please select at least one employee")
        }
        const request = db.request()
        const params = employeeCodes.map((c, i) => {
            request.input(`code${i}`, sql.VarChar, c)
            return `@code${i}`
        })
        const empRes = await request.query(`
            SELECT e.emp_code AS user_code, CONCAT(ISNULL(e.first_name, ''), ' ', ISNULL(e.last_name, '')) AS emp_name, ISNULL(dp.depart_name, '') AS depart_name, ISNULL(d.desig_name, '') AS desig_name
            FROM tbl_employee_mst e
            LEFT JOIN tbl_designation_mst d ON e.designation_code = d.desig_code
            LEFT JOIN tbl_department_mst dp ON e.department_code = dp.depart_code
            WHERE e.emp_code IN (${params.join(',')}) AND e.is_active = 1
        `)
        targetEmployees = empRes.recordset
    }

    for (const emp of targetEmployees) {
        const checkReq = db.request()
        checkReq.input("user_code", sql.VarChar, emp.user_code)
        const checkRes = await checkReq.query(`
            SELECT id FROM tbl_payroll_employee_work_schedules WHERE user_code = @user_code
        `)

        const upsertReq = db.request()
        upsertReq.input("user_code", sql.VarChar, emp.user_code)
        upsertReq.input("employee_name", sql.VarChar, emp.emp_name)
        upsertReq.input("department", sql.VarChar, emp.depart_name || '')
        upsertReq.input("designation", sql.VarChar, emp.desig_name || '')
        upsertReq.input("target_type", sql.VarChar, targetType)
        upsertReq.input("work_week", sql.VarChar, workWeekJson)
        upsertReq.input("working_hours_per_day", sql.Decimal(4, 2), workingHours)
        upsertReq.input("is_fixed_start_end", sql.Bit, isFixedStartEnd)
        upsertReq.input("start_time", sql.VarChar, startTime)
        upsertReq.input("end_time", sql.VarChar, endTime)
        upsertReq.input("overtime_applicable", sql.Bit, overtimeApplicable)
        upsertReq.input("overtime_rate", sql.Decimal(4, 2), overtimeRate)
        upsertReq.input("shift_allowance", sql.Decimal(10, 2), shiftAllowance)
        upsertReq.input("night_shift_allowance", sql.Decimal(10, 2), nightShiftAllowance)

        if (checkRes.recordset && checkRes.recordset.length > 0) {
            upsertReq.input("id", sql.Int, checkRes.recordset[0].id)
            await upsertReq.query(`
                UPDATE tbl_payroll_employee_work_schedules
                SET employee_name = @employee_name,
                    department = @department,
                    designation = @designation,
                    target_type = @target_type,
                    work_week = @work_week,
                    working_hours_per_day = @working_hours_per_day,
                    is_fixed_start_end = @is_fixed_start_end,
                    start_time = @start_time,
                    end_time = @end_time,
                    overtime_applicable = @overtime_applicable,
                    overtime_rate = @overtime_rate,
                    shift_allowance = @shift_allowance,
                    night_shift_allowance = @night_shift_allowance,
                    updated_at = GETDATE()
                WHERE id = @id
            `)
        } else {
            await upsertReq.query(`
                INSERT INTO tbl_payroll_employee_work_schedules (
                    user_code, employee_name, department, designation, target_type,
                    work_week, working_hours_per_day, is_fixed_start_end, start_time, end_time,
                    overtime_applicable, overtime_rate, shift_allowance, night_shift_allowance, updated_at
                ) VALUES (
                    @user_code, @employee_name, @department, @designation, @target_type,
                    @work_week, @working_hours_per_day, @is_fixed_start_end, @start_time, @end_time,
                    @overtime_applicable, @overtime_rate, @shift_allowance, @night_shift_allowance, GETDATE()
                )
            `)
        }
    }

    return { success: true, count: targetEmployees.length, message: `Work schedule saved for ${targetEmployees.length} employee(s)` }
}

async function updateWorkScheduleRepo(req) {
    const db = req.tenantDB
    const { id } = req.params
    const schedule = req.body

    const workWeekJson = JSON.stringify(schedule.workWeek || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
    const request = db.request()

    request.input("id", sql.Int, id)
    request.input("work_week", sql.VarChar, workWeekJson)
    request.input("working_hours_per_day", sql.Decimal(4, 2), schedule.workingHoursPerDay || 9.0)
    request.input("is_fixed_start_end", sql.Bit, schedule.isFixedStartEnd ? 1 : 0)
    request.input("start_time", sql.VarChar, schedule.startTime || '09:00')
    request.input("end_time", sql.VarChar, schedule.endTime || '18:00')
    request.input("overtime_applicable", sql.Bit, schedule.overtimeApplicable ? 1 : 0)
    request.input("overtime_rate", sql.Decimal(4, 2), schedule.overtimeRate || 1.5)
    request.input("shift_allowance", sql.Decimal(10, 2), schedule.shiftAllowance || 0.0)

    await request.query(`
        UPDATE tbl_payroll_employee_work_schedules
        SET
            work_week = @work_week,
            working_hours_per_day = @working_hours_per_day,
            is_fixed_start_end = @is_fixed_start_end,
            start_time = @start_time,
            end_time = @end_time,
            overtime_applicable = @overtime_applicable,
            overtime_rate = @overtime_rate,
            shift_allowance = @shift_allowance,
            updated_at = GETDATE()
        WHERE id = @id
    `)

    return { success: true, message: "Work schedule updated successfully" }
}

async function deleteWorkScheduleRepo(req) {
    const db = req.tenantDB
    const { id } = req.params

    const request = db.request()
    request.input("id", sql.Int, id)
    await request.query(`DELETE FROM tbl_payroll_employee_work_schedules WHERE id = @id`)

    return { success: true, message: "Work schedule deleted successfully" }
}

module.exports = { getWorkSchedulesRepo, saveWorkScheduleRepo, updateWorkScheduleRepo, deleteWorkScheduleRepo }
