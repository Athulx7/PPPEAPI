const { getMenuMappingSystemroles, getMenuMappingDepartment, getMenuMappingDesignation, getMenuMappingEmployees, getAllSubMenus, loadMenuMapping } = require("../Repositories/MenuMapping/getDatasModuleMapping")
const { saveMenuMapping } = require("../Repositories/MenuMapping/saveModuleMapping")

async function getMenuMappingSystemrolesController(req, res) {
    try {
        const result = await getMenuMappingSystemroles(req)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('getting System Roles for ', err)
        return res.status(500).json({
            success: false,
            message: 'failed to get system roles for menu mapping'
        })
    }
}

async function getMenuMappingDepartmentController(req, res) {
    try {
        const result = await getMenuMappingDepartment(req)
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

async function getMenuMappingDesignationController(req, res) {
    try {
        const result = await getMenuMappingDesignation(req)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('getting designation for menu mapping', err)
        return res.status(500).json({
            success: false,
            message: 'failed to get designation for menu mapping'
        })
    }
}

async function getMenuMappingEmployeesController(req, res) {
    try {
        const result = await getMenuMappingEmployees(req)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('getting Employee for menu mapping', err)
        return res.status(500).json({
            success: false,
            message: 'failed to get Employee for menu mapping'
        })
    }
}

async function getMenuMappingAllMenusController(req, res) {
    try {
        const result = await getAllSubMenus(req)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('getting All Sub Menus for menu mapping', err)
        return res.status(500).json({
            success: false,
            message: 'failed to get All Sub Menus for menu mapping'
        })
    }
}

async function getMenuMappingLoadMenu(req, res) {
    try {
        const result = await loadMenuMapping(req)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('getting All Sub Menus for menu mapping', err)
        return res.status(500).json({
            success: false,
            message: 'failed to get All Sub Menus for menu mapping'
        })
    }
}

async function SaveMenuMappingController(req, res) {
    try {
        const result = await saveMenuMapping(req)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('save All Sub Menus for menu mapping', err)
        return res.status(500).json({
            success: false,
            message: 'failed to save All Sub Menus for menu mapping'
        })
    }
}

module.exports = {
    getMenuMappingSystemrolesController,
    getMenuMappingDepartmentController,
    getMenuMappingDesignationController,
    getMenuMappingEmployeesController,
    getMenuMappingAllMenusController,
    getMenuMappingLoadMenu,
    SaveMenuMappingController
}