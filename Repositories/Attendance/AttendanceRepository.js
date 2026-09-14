const sql = require("mssql");

async function getMyAttendanceRepo(req) {
    const userCode = req.user?.user_code || req.user?.emp_code;
    const db = req.tenantDB;
    const request = db.request();

    request.input("emp_code", sql.VarChar, userCode);

    const query = `
        SELECT
            id,
            emp_code,
            FORMAT(attendance_date, 'yyyy-MM-dd') AS date,
            FORMAT(attendance_date, 'yyyy-MM-dd') AS attendance_date,
            CONVERT(VARCHAR(8), punch_in_time, 108) AS punch_in_time,
            CONVERT(VARCHAR(8), punch_out_time, 108) AS punch_out_time,
            punch_in_source,
            punch_out_source,
            total_worked_minutes,
            LOWER(status) AS status,
            is_regularized,
            regularization_id,
            remarks,
            ISNULL(overtime_minutes, 0) AS overtime_minutes,
            ISNULL(eligible_carry_forward_minutes, 0) AS eligible_carry_forward_minutes
        FROM tbl_attendance
        WHERE emp_code = @emp_code
        ORDER BY attendance_date DESC;
    `;

    const result = await request.query(query);
    return { data: result.recordset || [] };
}

async function getMyRegularizationsRepo(req) {
    const userCode = req.user?.user_code || req.user?.emp_code;
    const db = req.tenantDB;
    const request = db.request();

    request.input("emp_code", sql.VarChar, userCode);

    const query = `
        SELECT
            id,
            request_code,
            emp_code,
            FORMAT(attendance_date, 'yyyy-MM-dd') AS date,
            FORMAT(attendance_date, 'yyyy-MM-dd') AS attendance_date,
            original_punch_in,
            original_punch_out,
            requested_punch_in AS punch_in,
            requested_punch_out AS punch_out,
            reason,
            LOWER(status) AS status,
            FORMAT(applied_on, 'yyyy-MM-dd') AS applied_on,
            approved_by,
            FORMAT(approved_on, 'yyyy-MM-dd') AS approved_on,
            comments
        FROM tbl_attendance_regularization
        WHERE emp_code = @emp_code
        ORDER BY id DESC;
    `;

    const result = await request.query(query);
    return { data: result.recordset || [] };
}

async function applyRegularizationRepo(req) {
    const userCode = req.user?.user_code || req.user?.emp_code;
    const { date, attendance_date, punch_in, punch_out, requested_punch_in, requested_punch_out, reason = '' } = req.body || {};
    const targetDate = date || attendance_date;
    const reqPunchIn = requested_punch_in || punch_in;
    const reqPunchOut = requested_punch_out || punch_out;

    if (!targetDate || !reqPunchIn || !reqPunchOut || !reason) {
        throw new Error("Date, punch-in time, punch-out time, and reason are required.");
    }

    const db = req.tenantDB;
    const request = db.request();
    const requestCode = 'REG' + Date.now();

    request.input("request_code", sql.VarChar, requestCode);
    request.input("emp_code", sql.VarChar, userCode);
    request.input("attendance_date", sql.Date, targetDate);
    request.input("requested_punch_in", sql.VarChar, reqPunchIn);
    request.input("requested_punch_out", sql.VarChar, reqPunchOut);
    request.input("reason", sql.VarChar, reason);
    request.input("status", sql.VarChar, "Pending");

    const query = `
        INSERT INTO tbl_attendance_regularization (
            request_code,
            emp_code,
            attendance_date,
            requested_punch_in,
            requested_punch_out,
            reason,
            status,
            applied_on,
            created_by,
            created_date
        ) VALUES (
            @request_code,
            @emp_code,
            @attendance_date,
            @requested_punch_in,
            @requested_punch_out,
            @reason,
            @status,
            GETDATE(),
            @emp_code,
            GETDATE()
        );
    `;

    await request.query(query);

    return {
        success: true,
        message: "Attendance regularization request submitted successfully"
    };
}

async function transferCurrentMonthAttendanceRepo(req) {

    const db = req.tenantDB;

    if (!db) {
        throw new Error("Tenant database connection not found.");
    }

    const { attendance } = req.body || {};
    console.log('attendance', attendance)

    if (!Array.isArray(attendance) || attendance.length === 0) {
        throw new Error(
            "Attendance data is required and must be a non-empty array."
        );
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const skippedEmployees = [];


    for (const record of attendance) {

        const {
            emp_code,
            attendance_date,
            punch_in_time,
            punch_out_time,

            punch_in_source = "API",
            punch_out_source = "API",

            punch_in_device_id = null,
            punch_out_device_id = null,

            total_worked_minutes = null,

            status = "Present",

            is_regularized = false,
            regularization_id = null,

            remarks = null,

            created_by = "API",
            modified_by = null
        } = record;


        /*
         * Validate required fields
         */
        if (!emp_code || !attendance_date) {

            skipped++;

            skippedEmployees.push({
                emp_code: emp_code || null,
                attendance_date: attendance_date || null,
                reason: "Employee code and attendance date are required"
            });

            continue;
        }


        /*
         * Check employee exists
         */
        const employeeRequest = db.request();

        employeeRequest.input(
            "emp_code",
            sql.VarChar,
            emp_code
        );

        const employeeResult =
            await employeeRequest.query(`
                SELECT emp_code
                FROM tbl_employee_mst
                WHERE emp_code = @emp_code
                AND is_active = 1
            `);


        if (employeeResult.recordset.length === 0) {

            skipped++;

            skippedEmployees.push({
                emp_code,
                attendance_date,
                reason: "Employee not found or inactive"
            });

            continue;
        }


        /*
         * Check whether attendance already exists
         */
        const checkRequest = db.request();

        checkRequest.input(
            "emp_code",
            sql.VarChar,
            emp_code
        );

        checkRequest.input(
            "attendance_date",
            sql.Date,
            attendance_date
        );

        const existingResult =
            await checkRequest.query(`
                SELECT id
                FROM tbl_attendance
                WHERE emp_code = @emp_code
                AND CAST(attendance_date AS DATE) = @attendance_date
            `);


        // Fetch employee work schedule for overtime calculation
        let workedMins = total_worked_minutes;
        if (!workedMins && punch_in_time && punch_out_time) {
            const [h1, m1] = punch_in_time.split(':').map(Number);
            const [h2, m2] = punch_out_time.split(':').map(Number);
            workedMins = (h2 * 60 + (m2 || 0)) - (h1 * 60 + (m1 || 0));
        }

        let otMins = 0;
        let cfMins = 0;
        try {
            const schedRes = await db.request()
                .input("user_code", sql.VarChar, emp_code)
                .query(`SELECT TOP 1 working_hours_per_day, overtime_applicable, overtime_carry_forward, overtime_carry_forward_max_mins FROM tbl_payroll_employee_work_schedules WHERE user_code = @user_code ORDER BY id DESC`);
            const userSched = schedRes.recordset[0] || {};
            const stdMins = Math.round(Number(userSched.working_hours_per_day || 8) * 60);
            const isOtApp = Boolean(userSched.overtime_applicable);
            const isOtCf = Boolean(userSched.overtime_carry_forward);
            const maxCfMins = Number(userSched.overtime_carry_forward_max_mins || 30);

            if (workedMins && workedMins > stdMins && isOtApp) {
                otMins = workedMins - stdMins;
                if (isOtCf) {
                    cfMins = Math.min(otMins, maxCfMins);
                }
            }
        } catch (e) {
            console.log("Schedule fetch for OT note:", e.message);
        }

        /*
         * UPDATE existing attendance
         */
        if (existingResult.recordset.length > 0) {

            const updateRequest = db.request();

            updateRequest.input(
                "emp_code",
                sql.VarChar,
                emp_code
            );

            updateRequest.input(
                "attendance_date",
                sql.Date,
                attendance_date
            );

            updateRequest.input(
                "punch_in_time",
                sql.VarChar,
                punch_in_time
            );

            updateRequest.input(
                "punch_out_time",
                sql.VarChar,
                punch_out_time
            );

            updateRequest.input(
                "punch_in_source",
                sql.VarChar,
                punch_in_source
            );

            updateRequest.input(
                "punch_out_source",
                sql.VarChar,
                punch_out_source
            );

            updateRequest.input(
                "punch_in_device_id",
                sql.VarChar,
                punch_in_device_id
            );

            updateRequest.input(
                "punch_out_device_id",
                sql.VarChar,
                punch_out_device_id
            );

            updateRequest.input(
                "total_worked_minutes",
                sql.Int,
                workedMins
            );

            updateRequest.input(
                "overtime_minutes",
                sql.Int,
                otMins
            );

            updateRequest.input(
                "eligible_carry_forward_minutes",
                sql.Int,
                cfMins
            );

            updateRequest.input(
                "status",
                sql.VarChar,
                status
            );

            updateRequest.input(
                "is_regularized",
                sql.Bit,
                is_regularized
            );

            updateRequest.input(
                "regularization_id",
                sql.Int,
                regularization_id
            );

            updateRequest.input(
                "remarks",
                sql.VarChar,
                remarks
            );

            updateRequest.input(
                "modified_by",
                sql.VarChar,
                modified_by || created_by
            );


            await updateRequest.query(`
                UPDATE tbl_attendance

                SET
                    punch_in_time = @punch_in_time,
                    punch_out_time = @punch_out_time,

                    punch_in_source = @punch_in_source,
                    punch_out_source = @punch_out_source,

                    punch_in_device_id = @punch_in_device_id,
                    punch_out_device_id = @punch_out_device_id,

                    total_worked_minutes = @total_worked_minutes,
                    overtime_minutes = @overtime_minutes,
                    eligible_carry_forward_minutes = @eligible_carry_forward_minutes,

                    status = @status,

                    is_regularized = @is_regularized,

                    regularization_id = @regularization_id,

                    remarks = @remarks,

                    modified_by = @modified_by,

                    modified_date = GETDATE()

                WHERE emp_code = @emp_code
                AND CAST(attendance_date AS DATE) = @attendance_date
            `);

            updated++;

        }

        /*
         * INSERT new attendance
         */
        else {

            const insertRequest = db.request();

            insertRequest.input(
                "emp_code",
                sql.VarChar,
                emp_code
            );

            insertRequest.input(
                "attendance_date",
                sql.Date,
                attendance_date
            );

            insertRequest.input(
                "punch_in_time",
                sql.VarChar,
                punch_in_time
            );

            insertRequest.input(
                "punch_out_time",
                sql.VarChar,
                punch_out_time
            );

            insertRequest.input(
                "punch_in_source",
                sql.VarChar,
                punch_in_source
            );

            insertRequest.input(
                "punch_out_source",
                sql.VarChar,
                punch_out_source
            );

            insertRequest.input(
                "punch_in_device_id",
                sql.VarChar,
                punch_in_device_id
            );

            insertRequest.input(
                "punch_out_device_id",
                sql.VarChar,
                punch_out_device_id
            );

            insertRequest.input(
                "total_worked_minutes",
                sql.Int,
                workedMins
            );

            insertRequest.input(
                "overtime_minutes",
                sql.Int,
                otMins
            );

            insertRequest.input(
                "eligible_carry_forward_minutes",
                sql.Int,
                cfMins
            );

            insertRequest.input(
                "status",
                sql.VarChar,
                status
            );

            insertRequest.input(
                "is_regularized",
                sql.Bit,
                is_regularized
            );

            insertRequest.input(
                "regularization_id",
                sql.Int,
                regularization_id
            );

            insertRequest.input(
                "remarks",
                sql.VarChar,
                remarks
            );

            insertRequest.input(
                "created_by",
                sql.VarChar,
                created_by
            );


            await insertRequest.query(`
                INSERT INTO tbl_attendance (
                    emp_code,
                    attendance_date,

                    punch_in_time,
                    punch_out_time,

                    punch_in_source,
                    punch_out_source,

                    punch_in_device_id,
                    punch_out_device_id,

                    total_worked_minutes,
                    overtime_minutes,
                    eligible_carry_forward_minutes,

                    status,

                    is_regularized,
                    regularization_id,

                    remarks,

                    created_by,
                    created_date
                )

                VALUES (
                    @emp_code,
                    @attendance_date,

                    @punch_in_time,
                    @punch_out_time,

                    @punch_in_source,
                    @punch_out_source,

                    @punch_in_device_id,
                    @punch_out_device_id,

                    @total_worked_minutes,
                    @overtime_minutes,
                    @eligible_carry_forward_minutes,

                    @status,

                    @is_regularized,
                    @regularization_id,

                    @remarks,

                    @created_by,
                    GETDATE()
                )
            `);

            inserted++;
        }
    }


    return {
        totalRecords: attendance.length,
        inserted,
        updated,
        skipped,
        skippedEmployees
    };
}


module.exports = {
    getMyAttendanceRepo,
    getMyRegularizationsRepo,
    applyRegularizationRepo,
    transferCurrentMonthAttendanceRepo
}
