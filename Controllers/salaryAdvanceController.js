const {
    getSalaryAdvanceInfoRepo,
    getMySalaryAdvanceRequestsRepo,
    createSalaryAdvanceRequestRepo,
    cancelSalaryAdvanceRequestRepo,
    getDownlineSalaryAdvanceRequestsRepo,
    approveSalaryAdvanceRequestRepo,
    rejectSalaryAdvanceRequestRepo,
    disburseSalaryAdvanceRequestRepo
} = require('../Repositories/SalaryAdvance/salaryAdvanceRepo');

async function getSalaryAdvanceInfoController(req, res) {
    try {
        const data = await getSalaryAdvanceInfoRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (err) {
        console.error("Error in getSalaryAdvanceInfoController:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to fetch salary advance info"
        });
    }
}

async function getMySalaryAdvanceRequestsController(req, res) {
    try {
        const data = await getMySalaryAdvanceRequestsRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (err) {
        console.error("Error in getMySalaryAdvanceRequestsController:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to fetch salary advance requests"
        });
    }
}

async function createSalaryAdvanceRequestController(req, res) {
    try {
        const result = await createSalaryAdvanceRequestRepo(req);
        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (err) {
        console.error("Error in createSalaryAdvanceRequestController:", err);
        return res.status(400).json({
            success: false,
            message: err.message || "Failed to create salary advance request"
        });
    }
}

async function cancelSalaryAdvanceRequestController(req, res) {
    try {
        const result = await cancelSalaryAdvanceRequestRepo(req);
        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (err) {
        console.error("Error in cancelSalaryAdvanceRequestController:", err);
        return res.status(400).json({
            success: false,
            message: err.message || "Failed to cancel salary advance request"
        });
    }
}

async function getDownlineSalaryAdvanceRequestsController(req, res) {
    try {
        const data = await getDownlineSalaryAdvanceRequestsRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (err) {
        console.error("Error in getDownlineSalaryAdvanceRequestsController:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to fetch downline salary advance requests"
        });
    }
}

async function approveSalaryAdvanceRequestController(req, res) {
    try {
        const result = await approveSalaryAdvanceRequestRepo(req);
        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (err) {
        console.error("Error in approveSalaryAdvanceRequestController:", err);
        return res.status(400).json({
            success: false,
            message: err.message || "Failed to approve salary advance request"
        });
    }
}

async function rejectSalaryAdvanceRequestController(req, res) {
    try {
        const result = await rejectSalaryAdvanceRequestRepo(req);
        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (err) {
        console.error("Error in rejectSalaryAdvanceRequestController:", err);
        return res.status(400).json({
            success: false,
            message: err.message || "Failed to reject salary advance request"
        });
    }
}

async function disburseSalaryAdvanceRequestController(req, res) {
    try {
        const result = await disburseSalaryAdvanceRequestRepo(req);
        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (err) {
        console.error("Error in disburseSalaryAdvanceRequestController:", err);
        return res.status(400).json({
            success: false,
            message: err.message || "Failed to disburse salary advance request"
        });
    }
}

module.exports = {
    getSalaryAdvanceInfoController,
    getMySalaryAdvanceRequestsController,
    createSalaryAdvanceRequestController,
    cancelSalaryAdvanceRequestController,
    getDownlineSalaryAdvanceRequestsController,
    approveSalaryAdvanceRequestController,
    rejectSalaryAdvanceRequestController,
    disburseSalaryAdvanceRequestController
};
