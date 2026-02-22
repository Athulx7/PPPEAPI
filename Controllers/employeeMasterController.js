const { getEmpMasterControls, getEmpMstDropdwonData } = require("../Repositories/emp_master/getEmpMasterControls")
const { getDepartmentForEmpMstList, getDesignantionForEmpList, gethierarchyLevelForEmpMstList, getEmployeeList, getEmployeeById } = require("../Repositories/emp_master/getEmpMstEmployeeList")
const { saveEmpMaster, updateEmpMaster } = require("../Repositories/emp_master/saveEmpMaster")

async function getEMpMasterCntrlsController(req, res) {
    try {
        const result = await getEmpMasterControls(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (Err) {
        console.log('error mployee mst controlls', Err)
        return res.status(500).json({
            success: false,
            message: 'faild to get employee mst controlls'
        })
    }
}

async function getEmpMstDropdwonDataController(req, res) {
    try {
        const result = await getEmpMstDropdwonData(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('error mployee mst dropdowndata', err)
        return res.status(500).json({
            success: false,
            message: 'faild to get employee mst dropdown data'
        })
    }
}

async function saveEmpmasterController(req, res) {
    try {
        const result = await saveEmpMaster(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('error in saving emp mst', err)
        return res.status(500).json({
            success: false,
            message: 'faild to save employee mst'
        })
    }
}

async function getDepartmentForEMpListController(req, res) {
    try {
        const result = await getDepartmentForEmpMstList(req)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('getting department for employee mst list', err)
        return res.status(500).json({
            success: false,
            message: 'faild to get Department employee mst'
        })
    }
}

async function getDesignationForEMpListController(req, res) {
    try {
        const data = await getDesignantionForEmpList(req)
        return res.status(200).json({
            success: true,
            message: "success",
            data
        })

    } catch (err) {
        console.log('getting Designation for employee mst list', err)
        return res.status(500).json({
            success: false,
            message: 'Failed to get designation list'
        })
    }
}

async function gethierarchyLevelForEMpListController(req, res) {
    try {
        const result = await gethierarchyLevelForEmpMstList(req)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('getting Hiehrarchy Level for employee mst list', err)
        return res.status(500).json({
            success: false,
            message: 'faild to get hiehrarchy level employee mst'
        })
    }
}

async function getEmployeeListController(req, res) {
    try {
        const result = await getEmployeeList(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('error in getting employee list', err)
    }
}

async function getEmployeeByIDController(req, res) {
    try {
        const result = await getEmployeeById(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('error in getting employee by id', err)
    }
}

async function UpdateEMpMstController(req, res) {
    try {
        const result = await updateEmpMaster(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('error in getting employee by id', err)
    }
}

module.exports = { getEMpMasterCntrlsController, getEmpMstDropdwonDataController, saveEmpmasterController, getDepartmentForEMpListController, getDesignationForEMpListController, gethierarchyLevelForEMpListController, getEmployeeListController, getEmployeeByIDController, UpdateEMpMstController }