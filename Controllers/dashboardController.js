const {
    getAdminDashboardDataRepo,
    getHrDashboardDataRepo,
    getPayrollDashboardDataRepo,
    getEmployeeDashboardDataRepo
} = require("../Repositories/Dashboard/dashboardRepo");

async function getAdminDashboardController(req, res) {
    try {
        const data = await getAdminDashboardDataRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error("getAdminDashboardController error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch admin dashboard data",
            error: error.message
        });
    }
}

async function getHrDashboardController(req, res) {
    try {
        const data = await getHrDashboardDataRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error("getHrDashboardController error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch HR dashboard data",
            error: error.message
        });
    }
}

async function getPayrollDashboardController(req, res) {
    try {
        const data = await getPayrollDashboardDataRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error("getPayrollDashboardController error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch payroll dashboard data",
            error: error.message
        });
    }
}

async function getEmployeeDashboardController(req, res) {
    try {
        const data = await getEmployeeDashboardDataRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error("getEmployeeDashboardController error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch employee dashboard data",
            error: error.message
        });
    }
}

module.exports = {
    getAdminDashboardController,
    getHrDashboardController,
    getPayrollDashboardController,
    getEmployeeDashboardController
};
