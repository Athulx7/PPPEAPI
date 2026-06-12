const { FungetDepartMentForLeavesettings, FunGetDesignantionForLeavesettings, FunGetHierarchyLevelForLeavesettings, FunGetEmpTypeForLeavesettings, FunGetEmployeesForLeaveSettings, FunGetAllEmplForLeavesettings, FunGetAllDesignationForLeavesettings } = require("../Repositories/LeaveSettings/getComData")
const { getLeaveTypesForLeaveSettingRepo } = require("../Repositories/LeaveSettings/getLeaveTypesForSelecting")
const { getLeaveAllocationsRepo, getLeaveAllocationByIdRepo, saveSingleAllocationRepo, saveBulkAllocationRepo, updateLeaveAllocationRepo, deleteLeaveAllocationRepo } = require("../Repositories/LeaveSettings/saveAndOtherLeaveSettings")

async function getLeaveSettingsDepartmentController(req, res) {
    try {
        const result = await FungetDepartMentForLeavesettings(req)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('getting department for menu mapping', err)
        return res.status(500).json({
            success: false,
            message: 'failed to get department for menu mapping'
        })
    }
}

async function getLeaveSettingsDesignationController(req, res) {
    try {
        const result = await FunGetDesignantionForLeavesettings(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('getting department for menu mapping', err)
        return res.status(500).json({
            success: false,
            message: 'failed to get department for menu mapping'
        })
    }
}

async function getLeaveSettingsHierarchyController(req, res) {
    try {
        const result = await FunGetHierarchyLevelForLeavesettings(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('getting department for menu mapping', err)
        return res.status(500).json({ success: false, message: 'failed to get department for menu mapping' })
    }
}

async function getLeaveSettingsEmployeeTypeController(req, res) {
    try {
        const result = await FunGetEmpTypeForLeavesettings(req, res)
        return res.status(200).json({ success: true, message: "success", data: result })
    }
    catch (err) {
        console.log('getting department for menu mapping', err)
        return res.status(500).json({
            success: false,
            message: 'failed to get department for menu mapping'
        })
    }
}

async function getLeaveSettingsEMployeesListController(req, res) {
    try {
        const result = await FunGetEmployeesForLeaveSettings(req, res)
        return res.status(200).json({ success: true, message: "success", data: result })
    }
    catch (err) {
        console.log('getting department for menu mapping', err)
        return res.status(500).json({ success: false, message: 'failed to get department for menu mapping' })
    }
}

async function getLeaveTypesForSettingsController(req, res) {
    try {
        const result = await getLeaveTypesForLeaveSettingRepo(req)
        return res.status(200).json({ success: true, message: "success", data: result })
    } catch (err) {
        console.log("getLeaveTypesForLeaveSettingController:", err)
        return res.status(500).json({ success: false, message: "Failed to fetch leave types for leave setting" })
    }
}

async function getLeaveAllocationsController(req, res) {
    try {
        const result = await getLeaveAllocationsRepo(req)
        return res.status(200).json({ success: true, message: "success", data: result })
    } catch (err) {
        console.log("getLeaveAllocationsController:", err)
        return res.status(500).json({ success: false, message: "Failed to fetch leave allocations" })
    }
}

async function getLeaveAllocationByIdController(req, res) {
    try {
        const result = await getLeaveAllocationByIdRepo(req)
        return res.status(200).json({ success: true, message: "success", data: result })
    } catch (err) {
        console.log("getLeaveAllocationByIdController:", err)
        if (err.message === "Allocation not found") {
            return res.status(404).json({ success: false, message: err.message })
        }
        return res.status(500).json({ success: false, message: "Failed to fetch allocation" })
    }
}

async function saveSingleAllocationController(req, res) {
    try {
        const result = await saveSingleAllocationRepo(req)
        return res.status(200).json({ success: true, message: "Leave allocated successfully", data: result })
    } catch (err) {
        console.log("saveSingleAllocationController:", err)
        if (err.message.includes("already exists")) {
            return res.status(409).json({ success: false, message: err.message })
        }
        return res.status(500).json({ success: false, message: "Failed to save allocation" })
    }
}

async function saveBulkAllocationController(req, res) {
    try {
        const result = await saveBulkAllocationRepo(req)
        return res.status(200).json({
            success: true,
            message: `${result.total_inserted} allocations created for ${result.total_employees} employees`,
            data: result
        })
    } catch (err) {
        console.log("saveBulkAllocationController:", err)
        if (err.message === "No employees match the selected criteria") {
            return res.status(400).json({ success: false, message: err.message })
        }
        return res.status(500).json({ success: false, message: "Failed to save bulk allocation" })
    }
}

async function updateLeaveAllocationController(req, res) {
    try {
        const result = await updateLeaveAllocationRepo(req)
        return res.status(200).json({ success: true, message: "Allocation updated successfully", data: result })
    } catch (err) {
        console.log("updateLeaveAllocationController:", err)
        if (err.message === "Allocation not found or inactive") {
            return res.status(404).json({ success: false, message: err.message })
        }
        return res.status(500).json({ success: false, message: "Failed to update allocation" })
    }
}

async function deleteLeaveAllocationController(req, res) {
    try {
        const result = await deleteLeaveAllocationRepo(req)
        return res.status(200).json({ success: true, message: "Allocation removed successfully", data: result })
    } catch (err) {
        console.log("deleteLeaveAllocationController:", err)
        if (err.message === "Allocation not found or already inactive") {
            return res.status(404).json({ success: false, message: err.message })
        }
        return res.status(500).json({ success: false, message: "Failed to delete allocation" })
    }
}

async function GetAllEmplForLeavesettings(req, res) {
    try {
        const result = await FunGetAllEmplForLeavesettings(req)
        return res.status(200).json({ success: true, message: "Employees fetched successfully", data: result })
    } catch (err) {
        console.log("GetAllEmplForLeavesettings:", err)
        if (err.message === "Allocation not found or already inactive") {
            return res.status(404).json({ success: false, message: err.message })
        }
        return res.status(500).json({ success: false, message: "Failed to fetch employees" })
    }
}

async function GetAllDesignationForLeavesettings(req, res) {
    try {
        const result = await FunGetAllDesignationForLeavesettings(req)
        return res.status(200).json({ success: true, message: "Designations fetched successfully", data: result })
    } catch (err) {
        console.log("GetAllDesignationForLeavesettings:", err)
        if (err.message === "Allocation not found or already inactive") {
            return res.status(404).json({ success: false, message: err.message })
        }
        return res.status(500).json({ success: false, message: "Failed to fetch designations" })
    }
}

module.exports = {
    getLeaveSettingsDepartmentController,
    getLeaveSettingsDesignationController,
    getLeaveSettingsHierarchyController,
    getLeaveSettingsEmployeeTypeController,
    getLeaveSettingsEMployeesListController,
    getLeaveTypesForSettingsController,
    getLeaveAllocationsController,
    getLeaveAllocationByIdController,
    saveSingleAllocationController,
    saveBulkAllocationController,
    updateLeaveAllocationController,
    deleteLeaveAllocationController,
    GetAllEmplForLeavesettings,
    GetAllDesignationForLeavesettings
}