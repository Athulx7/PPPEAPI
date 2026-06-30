const calendarRepository = require("../Repositories/JobTracking/calendarRepository")
/**
 * calendarController.js
 * Handles GET /jobs/calendar  — time-log blocks for a date range (week/day view)
 *         GET /jobs/calendar/month — density dots + job list per day (month view)
 *         GET /jobs/calendar/summary — sidebar stats for the month
 */

/**
 * GET /jobs/calendar?emp_code=&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns time-log rows (blocks) for the week/day time grid.
 */
const getCalendarBlocks = async (req, res) => {
    try {
        const pool = req.tenantDB;
        const empCode = req.query.emp_code || req.user?.emp_code;
        const { from, to } = req.query;

        if (!empCode) {
            return res.status(400).json({ success: false, message: "emp_code is required" });
        }
        if (!from || !to) {
            return res.status(400).json({ success: false, message: "from and to dates are required (YYYY-MM-DD)" });
        }

        const blocks = await calendarRepository.getCalendarBlocks(pool, empCode, from, to);

        res.status(200).json({ success: true, data: blocks });
    } catch (err) {
        console.error("getCalendarBlocks error:", err);
        res.status(500).json({ success: false, message: "Failed to load calendar blocks", error: err.message });
    }
};

/**
 * GET /jobs/calendar/month?emp_code=&year=2026&month=6
 * Returns { "2026-06-15": [job, ...], ... } for painting month dots.
 */
const getMonthActivity = async (req, res) => {
    try {
        const pool = req.tenantDB;
        const empCode = req.query.emp_code || req.user?.emp_code;
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;

        if (!empCode) {
            return res.status(400).json({ success: false, message: "emp_code is required" });
        }

        const activity = await calendarRepository.getMonthJobActivity(pool, empCode, year, month);
        res.status(200).json({ success: true, data: activity });
    } catch (err) {
        console.error("getMonthActivity error:", err);
        res.status(500).json({ success: false, message: "Failed to load month activity", error: err.message });
    }
};

/**
 * GET /jobs/calendar/summary?emp_code=&year=2026&month=6
 */
const getMonthSummary = async (req, res) => {
    try {
        const pool = req.tenantDB;
        const empCode = req.query.emp_code || req.user?.emp_code;
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;

        if (!empCode) {
            return res.status(400).json({ success: false, message: "emp_code is required" });
        }

        const summary = await calendarRepository.getMonthSummary(pool, empCode, year, month);
        res.status(200).json({ success: true, data: summary });
    } catch (err) {
        console.error("getMonthSummary error:", err);
        res.status(500).json({ success: false, message: "Failed to load month summary", error: err.message });
    }
};

module.exports = { getCalendarBlocks, getMonthActivity, getMonthSummary };