const sql = require("mssql")

const getCalendarBlocks = async (pool, empCode, fromDate, toDate) => {
    const result = await pool
        .request()
        .input("empCode", sql.VarChar(20), empCode)
        .input("fromDate", sql.Date, fromDate)
        .input("toDate", sql.Date, toDate)
        .query(`
            SELECT tl.time_log_id,
       tl.job_id,
       tl.emp_code,
       tl.start_time,
       tl.end_time,
       tl.duration_minutes,
       tl.log_type,
       tl.remarks,
       j.job_code,
       j.title,
       j.parent_job_id,
       j.assigned_department_code,
       j.due_date,
       js.status_code,
       js.status_name,
       js.color_code AS status_color,
       jp.priority_name,
       jp.color_code AS priority_color,
       jp.level AS priority_level,
       jt.type_name,
       jt.prefix_code
FROM   tbl_job_time_log tl
       INNER JOIN tbl_job j
               ON j.job_id = tl.job_id
       INNER JOIN tbl_job_status js
               ON js.id = j.status_id
       INNER JOIN tbl_job_priority jp
               ON jp.priority_id = j.priority_id
       INNER JOIN tbl_job_type jt
               ON jt.job_type_id = j.job_type_id
WHERE  tl.emp_code = @empCode
       AND CONVERT(DATE, tl.start_time) BETWEEN @fromDate AND @toDate
ORDER  BY tl.start_time ASC
        `)

    return result.recordset
}

const getMonthJobActivity = async (pool, empCode, year, month) => {
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`
    const lastDay = new Date(year, month, 0).toISOString().slice(0, 10)

    const result = await pool
        .request()
        .input("empCode", sql.VarChar(20), empCode)
        .input("firstDay", sql.Date, firstDay)
        .input("lastDay", sql.Date, lastDay)
        .query(`
            SELECT
                CONVERT(DATE, tl.start_time)   AS activity_date,
                j.job_id,
                j.job_code,
                j.title,
                js.status_code,
                js.status_name,
                js.color_code   AS status_color,
                jp.priority_name,
                jp.color_code   AS priority_color,
                SUM(tl.duration_minutes) AS total_minutes_on_day

            FROM tbl_job_time_log tl
            INNER JOIN tbl_job j ON j.job_id = tl.job_id
            INNER JOIN tbl_job_status js ON js.id = j.status_id
            INNER JOIN tbl_job_priority jp ON jp.priority_id = j.priority_id

            WHERE tl.emp_code  = @empCode
              AND CONVERT(DATE, tl.start_time) BETWEEN @firstDay AND @lastDay

            GROUP BY
                CONVERT(DATE, tl.start_time),
                j.job_id, j.job_code, j.title,
                js.status_code, js.status_name, js.color_code,
                jp.priority_name, jp.color_code

            ORDER BY activity_date, j.job_id
        `)

    const byDate = {}
    result.recordset.forEach((row) => {
        const dateKey = row.activity_date instanceof Date
            ? row.activity_date.toISOString().slice(0, 10)
            : String(row.activity_date).slice(0, 10)

        if (!byDate[dateKey]) byDate[dateKey] = []
        byDate[dateKey].push(row)
    })
    return byDate
}

const getMonthSummary = async (pool, empCode, year, month) => {
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`
    const lastDay = new Date(year, month, 0).toISOString().slice(0, 10)

    const result = await pool
        .request()
        .input("empCode", sql.VarChar(20), empCode)
        .input("firstDay", sql.Date, firstDay)
        .input("lastDay", sql.Date, lastDay)
        .query(`
            SELECT
                COUNT(DISTINCT CONVERT(DATE, tl.start_time)) AS active_days,
                COUNT(DISTINCT tl.job_id)  AS total_jobs,
                SUM(tl.duration_minutes) AS total_minutes,
                SUM(CASE WHEN js.status_code IN ('DONE','CLOSED') THEN 1 ELSE 0 END) AS completed_logs
            FROM tbl_job_time_log tl
            INNER JOIN tbl_job j ON j.job_id = tl.job_id
            INNER JOIN tbl_job_status js ON js.id = j.status_id
            WHERE tl.emp_code = @empCode
              AND CONVERT(DATE, tl.start_time) BETWEEN @firstDay AND @lastDay;
        `);

    return result.recordset[0] || { active_days: 0, total_jobs: 0, total_minutes: 0 }
}

module.exports = { getCalendarBlocks, getMonthJobActivity, getMonthSummary }