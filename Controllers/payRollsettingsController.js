const { getPayrollSettingsModuleDataRepo, getModuleFieldsAndDataRepo } = require("../Repositories/PayrollSettings/getPayrollSettingsModuleData")
const { saveModuleSettingsRepo } = require("../Repositories/PayrollSettings/savePayrollSettings")
const { getWorkSchedulesRepo, saveWorkScheduleRepo, updateWorkScheduleRepo, deleteWorkScheduleRepo } = require("../Repositories/PayrollSettings/workScheduleRepo")
const {
    savePtSlabRepo, updatePtSlabRepo, deletePtSlabRepo,
    saveLwfRepo, updateLwfRepo, deleteLwfRepo,
    saveEsiRepo,
    getStatesForStatutoryRepo
} = require("../Repositories/PayrollSettings/statutoryRepo")

async function getPayrollSettingsModulesController(req, res) {
    try {
        const data = await getPayrollSettingsModuleDataRepo(req)
        return res.status(200).json({
            success: true,
            data
        })
    } catch (error) {
        console.error("Error in getPayrollSettingsModulesController:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to fetch payroll modules",
            error: error.message
        })
    }
}

async function getModuleFieldsController(req, res) {
    try {
        const data = await getModuleFieldsAndDataRepo(req)
        return res.status(200).json({
            success: true,
            data
        })
    } catch (error) {
        console.error("Error in getModuleFieldsController:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to fetch module fields",
            error: error.message
        })
    }
}

async function saveModuleSettingsController(req, res) {
    try {
        const result = await saveModuleSettingsRepo(req)
        return res.status(200).json({
            success: true,
            message: result.message
        })
    } catch (error) {
        console.error("Error in saveModuleSettingsController:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to save module settings",
            error: error.message
        })
    }
}

async function getWorkSchedulesController(req, res) {
    try {
        const data = await getWorkSchedulesRepo(req)
        return res.status(200).json({
            success: true,
            data
        })
    } catch (error) {
        console.error("Error in getWorkSchedulesController:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to fetch work schedules",
            error: error.message
        })
    }
}

async function saveWorkScheduleController(req, res) {
    try {
        const result = await saveWorkScheduleRepo(req)
        return res.status(200).json({
            success: true,
            message: result.message
        })
    } catch (error) {
        console.error("Error in saveWorkScheduleController:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to save work schedules",
            error: error.message
        })
    }
}

async function updateWorkScheduleController(req, res) {
    try {
        const result = await updateWorkScheduleRepo(req)
        return res.status(200).json({
            success: true,
            message: result.message
        })
    } catch (error) {
        console.error("Error in updateWorkScheduleController:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to update work schedule",
            error: error.message
        })
    }
}

async function deleteWorkScheduleController(req, res) {
    try {
        const result = await deleteWorkScheduleRepo(req)
        return res.status(200).json({
            success: true,
            message: result.message
        })
    } catch (error) {
        console.error("Error in deleteWorkScheduleController:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to delete work schedule",
            error: error.message
        })
    }
}

// Statutory Controllers
async function getStatesForStatutoryController(req, res) {
    try {
        const data = await getStatesForStatutoryRepo(req)
        return res.status(200).json({
            success: true,
            data
        })
    }
    catch (error) {
        console.error("Error in getStatesForStatutoryController:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to fetch states for statutory",
            error: error.message
        })
    }
}

async function savePtSlabController(req, res) {
    try {
        const result = await savePtSlabRepo(req)
        return res.status(200).json({ success: true, message: result.message })
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message })
    }
}

async function updatePtSlabController(req, res) {
    try {
        const result = await updatePtSlabRepo(req)
        return res.status(200).json({ success: true, message: result.message })
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message })
    }
}

async function deletePtSlabController(req, res) {
    try {
        const result = await deletePtSlabRepo(req)
        return res.status(200).json({ success: true, message: result.message })
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message })
    }
}

async function saveLwfController(req, res) {
    try {
        const result = await saveLwfRepo(req)
        return res.status(200).json({ success: true, message: result.message })
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message })
    }
}

async function updateLwfController(req, res) {
    try {
        const result = await updateLwfRepo(req)
        return res.status(200).json({ success: true, message: result.message })
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message })
    }
}

async function deleteLwfController(req, res) {
    try {
        const result = await deleteLwfRepo(req)
        return res.status(200).json({ success: true, message: result.message })
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message })
    }
}

async function saveEsiController(req, res) {
    try {
        const result = await saveEsiRepo(req)
        return res.status(200).json({ success: true, message: result.message })
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message })
    }
}

module.exports = {
    getPayrollSettingsModulesController,
    getModuleFieldsController,
    saveModuleSettingsController,
    getWorkSchedulesController,
    saveWorkScheduleController,
    updateWorkScheduleController,
    deleteWorkScheduleController,
    savePtSlabController,
    updatePtSlabController,
    deletePtSlabController,
    saveLwfController,
    updateLwfController,
    deleteLwfController,
    saveEsiController,
    getStatesForStatutoryController
}