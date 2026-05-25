const { getLeaveMasterCategoryRepo, getLeaveCategoryDataBasedSelectionRepo, getLeaveconfigRepo, getLeaveMasterAccuralTypeRepo } = require("../Repositories/LeaveModule/getCommonDatas")
const { getLeaveTypeFOrTableRepo, getLeaveTypeWithID } = require("../Repositories/LeaveModule/getLeaveTypeDatas")
const { saveLeaveType, updateLeaveType, deleteLeaveTypeById } = require("../Repositories/LeaveModule/saveAndupdateLeaveType")

async function getLeaveMasterCategoryController(req, res) {
    try {
        const result = await getLeaveMasterCategoryRepo(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('getting leave master category data', err)
        return res.status(500).json({
            success: false,
            message: 'failed to get leave master category data'
        })
    }
}

async function getLeaveCategoryDataBasedSelectionController(req, res) {
    try {
        const result = await getLeaveCategoryDataBasedSelectionRepo(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('getting leave category data based on selection', err)
        return res.status(500).json({
            success: false,
            message: 'failed to get leave category data based on selection'
        })
    }
}

async function getLeaveconfigController(req, res) {
    try {
        const result = await getLeaveconfigRepo(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('getting leave config data', err)
        return res.status(500).json({
            success: false,
            message: 'failed to get leave config data'
        })
    }
}

async function getLeaveMasterAccuralTypeController(req, res) {
    try {
        const result = await getLeaveMasterAccuralTypeRepo(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('getting leave master accrual type data', err)
        return res.status(500).json({
            success: false,
            message: 'failed to get leave master accrual type data'
        })
    }
}

async function getLeaveTypeDataWithIDController(req, res) {
    try {
        const result = await getLeaveTypeWithID(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('getting leave type data with id', err)
        return res.status(500).json({
            success: false,
            message: 'failed to get leave type data with id'
        })
    }
}


async function getSavedLeaveTypeDataController(req, res) {
    try {
        const result = await getLeaveTypeFOrTableRepo(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('getting saved leave type data', err)
        return res.status(500).json({
            success: false,
            message: 'failed to get saved leave type data'
        })
    }
}

async function saveLeaveTypeController(req, res) {
    try {
        const result = await saveLeaveType(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('saving leave type data', err)
        return res.status(500).json({
            success: false,
            message: 'failed to save leave type data with id'
        })
    }
}

async function updateLeaveTypeController(req, res) {
    try {
        const result = await updateLeaveType(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('updating leave type data', err)
        return res.status(500).json({
            success: false,
            message: 'failed to update leave type data'
        })
    }
}

async function deleteLeaveTypeByIdController(req, res) {
    try {
        const response = await deleteLeaveTypeById(req)
        return res.status(200).json({
            success: true,
            message: "Leave type deactivated successfully",
            data: response
        })
    }
    catch (err) {
        console.log("Error in deleteLeaveTypeByIdController:", err)
        if (err.message === "Leave type not found or already inactive") {
            return res.status(404).json({
                success: false,
                message: err.message
            })
        }
        return res.status(500).json({
            success: false,
            message: "Internal server error while deleting leave type"
        })
    }
}

module.exports = {
    getLeaveMasterCategoryController, getLeaveCategoryDataBasedSelectionController,
    getLeaveconfigController, getLeaveMasterAccuralTypeController, saveLeaveTypeController,
    getSavedLeaveTypeDataController, getLeaveTypeDataWithIDController, updateLeaveTypeController, deleteLeaveTypeByIdController
}