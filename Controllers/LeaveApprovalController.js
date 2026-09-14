const {
    getDownlineLeaveRequestsRepo,
    approveLeaveRequestRepo,
    rejectLeaveRequestRepo
} = require("../Repositories/LeaveApproval/LeaveApprovalRepository");

async function getDownlineLeaveRequestsController(req, res) {
    try {
        const result = await getDownlineLeaveRequestsRepo(req);
        return res.status(200).json({ success: true, message: "success", data: result.data, user: result.user });
    } catch (err) {
        console.error("getDownlineLeaveRequestsController error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch downline leave requests" });
    }
}

async function approveLeaveRequestController(req, res) {
    try {
        const result = await approveLeaveRequestRepo(req);
        return res.status(200).json(result);
    } catch (err) {
        console.error("approveLeaveRequestController error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to approve leave request" });
    }
}

async function rejectLeaveRequestController(req, res) {
    try {
        const result = await rejectLeaveRequestRepo(req);
        return res.status(200).json(result);
    } catch (err) {
        console.error("rejectLeaveRequestController error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to reject leave request" });
    }
}

module.exports = {
    getDownlineLeaveRequestsController,
    approveLeaveRequestController,
    rejectLeaveRequestController
};
