const {
    getAutoRunConfigRepo,
    getPreflightChecksRepo,
    generatePayrollForPeriodRepo,
    getPayrollRunsRepo,
    getPayrollRunDetailsRepo,
    getPayslipDetailsRepo,
    getMyPayslipsRepo,
    getPayslipsRepo,
    getCtcReportRepo
} = require("../Repositories/Payroll/payrollGeneratorRepo");

// GET /api/payroll/auto-run-config
async function getAutoRunConfigController(req, res) {
    try {
        const data = await getAutoRunConfigRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (err) {
        console.error("Error in getAutoRunConfigController:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to fetch auto-run settings"
        });
    }
}

// GET /api/payroll/preflight-checks
async function getPreflightChecksController(req, res) {
    try {
        const data = await getPreflightChecksRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (err) {
        console.error("Error in getPreflightChecksController:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to fetch preflight checklist metrics"
        });
    }
}

// POST /api/payroll/run
async function runPayrollController(req, res) {
    try {
        const result = await generatePayrollForPeriodRepo(req);
        return res.status(200).json({
            success: true,
            message: "Payroll run executed successfully",
            data: result
        });
    } catch (err) {
        console.error("Error in runPayrollController:", err);
        return res.status(400).json({
            success: false,
            message: err.message || "Failed to execute payroll run"
        });
    }
}

// GET /api/payroll/runs
async function getPayrollRunsController(req, res) {
    try {
        const data = await getPayrollRunsRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (err) {
        console.error("Error in getPayrollRunsController:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to fetch payroll runs"
        });
    }
}

// GET /api/payroll/run/:runId
async function getPayrollRunDetailsController(req, res) {
    try {
        const data = await getPayrollRunDetailsRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (err) {
        console.error("Error in getPayrollRunDetailsController:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to fetch payroll run details"
        });
    }
}

// GET /api/payroll/payslip/:payslipId
async function getPayslipDetailsController(req, res) {
    try {
        const data = await getPayslipDetailsRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (err) {
        console.error("Error in getPayslipDetailsController:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to fetch payslip details"
        });
    }
}

// GET /api/payroll/payslips
async function getPayslipsController(req, res) {
    try {
        const data = await getPayslipsRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (err) {
        console.error("Error in getPayslipsController:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to fetch payslips list"
        });
    } 
}

// GET /api/payroll/ctc-report
async function getCtcReportController(req, res) {
    try {
        const data = await getCtcReportRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (err) {
        console.error("Error in getCtcReportController:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to fetch CTC report"
        });
    }
}

// GET /api/payroll/inspect/attendance-lop
async function getLopAttendanceInspectionController(req, res) {
    try {
        const { getLopAttendanceInspectionRepo } = require("../Repositories/Payroll/payrollInspectionRepo");
        const data = await getLopAttendanceInspectionRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (err) {
        console.error("Error in getLopAttendanceInspectionController:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to inspect LOP & attendance"
        });
    }
}

// GET /api/payroll/inspect/overtime
async function getOvertimeInspectionController(req, res) {
    try {
        const { getOvertimeInspectionRepo } = require("../Repositories/Payroll/payrollInspectionRepo");
        const data = await getOvertimeInspectionRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (err) {
        console.error("Error in getOvertimeInspectionController:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to inspect overtime"
        });
    }
}

// GET /api/payroll/inspect/advances
async function getAdvanceInspectionController(req, res) {
    try {
        const { getAdvanceInspectionRepo } = require("../Repositories/Payroll/payrollInspectionRepo");
        const data = await getAdvanceInspectionRepo(req);
        return res.status(200).json({
            success: true,
            data
        });
    } catch (err) {
        console.error("Error in getAdvanceInspectionController:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to inspect advances"
        });
    }
}

module.exports = {
    getAutoRunConfigController,
    getPreflightChecksController,
    runPayrollController,
    getPayrollRunsController,
    getPayrollRunDetailsController,
    getPayslipDetailsController,
    getPayslipsController,
    getCtcReportController,
    getLopAttendanceInspectionController,
    getOvertimeInspectionController,
    getAdvanceInspectionController
};
