const { deleteSalaryComponent } = require("../Repositories/salary_components/deleteSalaryComponent")
const { getSalaryComponents } = require("../Repositories/salary_components/getSalaryComponents")
const { saveSalaryComponents, updateSalaryComponent } = require("../Repositories/salary_components/saveSalaryComponents")

async function saveSalaryComponentsController(req, res) {
    try {
        const response = await saveSalaryComponents(req)
        return res.status(200).json({
            success: true,
            message: "Salary component saved successfully",
            data: response
        })
    }
    catch (err) {
        console.log("error in saving salary components", err)
        if (err.number === 2627 || err.number === 2601) {
            return res.status(400).json({
                success: false,
                message: "Component code already exists"
            })
        }

        if (err.message) {
            return res.status(400).json({
                success: false,
                message: err.message
            })
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error while saving salary component"
        })
    }
}

async function updateSalaryComponentController(req, res) {
    try {
        await updateSalaryComponent(req)
        return res.json({
            success: true,
            message: "Salary component updated successfully"
        })

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Error updating salary component"
        })
    }
}

async function getSalaryComponentsController(req, res) {
    try {
        const result = await getSalaryComponents(req)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log("error in getting salary components", err)
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching salary components"
        })
    }
}
async function deleteSalaryComponentController(req, res) {
    try {
        await deleteSalaryComponent(req)
        return res.json({
            success: true,
            message: "Salary component deleted"
        })
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Delete failed"
        })
    }
}
module.exports = { saveSalaryComponentsController, updateSalaryComponentController, getSalaryComponentsController, deleteSalaryComponentController }