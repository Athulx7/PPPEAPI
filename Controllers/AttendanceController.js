const {
    getMyAttendanceRepo,
    getMyRegularizationsRepo,
    applyRegularizationRepo,
    transferCurrentMonthAttendanceRepo
} = require("../Repositories/Attendance/AttendanceRepository");

async function getMyAttendanceController(req, res) {
    try {
        const result = await getMyAttendanceRepo(req);
        return res.status(200).json({ success: true, message: "success", data: result.data });
    } catch (err) {
        console.error("getMyAttendanceController error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch attendance records" });
    }
}

async function getMyRegularizationsController(req, res) {
    try {
        const result = await getMyRegularizationsRepo(req);
        return res.status(200).json({ success: true, message: "success", data: result.data });
    } catch (err) {
        console.error("getMyRegularizationsController error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch attendance regularization requests" });
    }
}

async function applyRegularizationController(req, res) {
    try {
        const result = await applyRegularizationRepo(req);
        return res.status(200).json(result);
    } catch (err) {
        console.error("applyRegularizationController error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to submit regularization request" });
    }
}

async function transferCurrentMonthAttendanceController(req, res) {
    try {
        const result = await transferCurrentMonthAttendanceRepo(req)
        return res.status(200).json({ success: true, message: "Current month attendance transferred successfully", data: result })

    } catch (err) {
        console.error("transferCurrentMonthAttendanceController error:", err)
        return res.status(500).json({ success: false, message: err.message || "Failed to transfer attendance" })
    }
}

module.exports = {
    getMyAttendanceController,
    getMyRegularizationsController,
    applyRegularizationController,
    transferCurrentMonthAttendanceController
};
