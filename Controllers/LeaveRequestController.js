const { getHolidayOfEmployeeBranchWIseREPO } = require("../Repositories/LeaveMyLeaves/getAllMyLeaveData");
const {
    getUserWorkScheduleRepo,
    getMyLeaveRequestsRepo,
    applyLeaveRequestRepo,
    cancelLeaveRequestRepo
} = require("../Repositories/LeaveRequest/LeaveRequestRepository");

async function getUserWorkScheduleController(req, res) {
    try {
        const result = await getUserWorkScheduleRepo(req);
        return res.status(200).json({ success: true, message: "success", data: result.data });
    } catch (err) {
        console.error("getUserWorkScheduleController error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch user work schedule" });
    }
}

async function getMyLeaveRequestsController(req, res) {
    try {
        const result = await getMyLeaveRequestsRepo(req);
        return res.status(200).json({ success: true, message: "success", data: result.data });
    } catch (err) {
        console.error("getMyLeaveRequestsController error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch leave requests" });
    }
}

async function applyLeaveRequestController(req, res) {
    try {
        const result = await applyLeaveRequestRepo(req);
        return res.status(200).json(result);
    } catch (err) {
        console.error("applyLeaveRequestController error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to submit leave request" });
    }
}

async function cancelLeaveRequestController(req, res) {
    try {
        const result = await cancelLeaveRequestRepo(req);
        return res.status(200).json(result);
    } catch (err) {
        console.error("cancelLeaveRequestController error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to cancel leave request" });
    }
}

async function getHolidayOfEmployeeBranchWIseController(req, res) {
    try {
        const result = await getHolidayOfEmployeeBranchWIseREPO(req, res);
        return res.status(200).json(result);
    } catch (err) {
        console.error("getHolidayOfEmployeeBranchWIseController error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to fetch holidays" });
    }
}


module.exports = {
    getUserWorkScheduleController,
    getMyLeaveRequestsController,
    applyLeaveRequestController,
    cancelLeaveRequestController,
    getHolidayOfEmployeeBranchWIseController
};
