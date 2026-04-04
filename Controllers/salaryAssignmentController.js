const { createAssignment, updateSalaryAssignment } = require("../Repositories/salary_structure/createSalaryAssignment")
const { getAssignmentById } = require("../Repositories/salary_structure/getAssignmentById")
const { getAssignmentDropdowns } = require("../Repositories/salary_structure/getAssignmentDropdowns")
const { getAllAssignments } = require("../Repositories/salary_structure/getSavedAssignment")

async function getAssignmentDropdownsController(req, res) {
    try {
        const result = await getAssignmentDropdowns(req)
        return res.status(200).json({
            success: true,
            message: "Dropdown data retrieved",
            data: result
        })
    }
    catch (err) {
        console.error('get assignment dropdown errors', err)
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve dropdown data"
        })
    }
}

async function createAssignmentController(req, res) {
    try {
        const data = await createAssignment(req)
        return res.json({
            success: true,
            message: "Salary structure assigned successfully",
            data
        })
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            success: false,
            message: "Failed to assign salary structure"
        })
    }
}

async function getAllAssignmentsController(req, res) {
    try {
        const data = await getAllAssignments(req)
        return res.json({
            success: true,
            data
        })
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            success: false,
            message: "Failed to fetch assignments"
        })
    }
}

async function getAssignmentByIdController(req, res) {
    try {
        const data = await getAssignmentById(req)

        return res.json({
            success: true,
            data
        })
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            success: false,
            message: "Failed to fetch assignment"
        })
    }
}

async function updateSalaryAssignmentController(req, res) {
    try {
        const data = await updateSalaryAssignment(req)

        return res.json({
            success: true,
            message: "Assignment updated successfully",
            data
        })

    } catch (err) {
        console.error("Update Assignment Error:", err)

        return res.status(500).json({
            success: false,
            message: err.message || "Failed to update assignment"
        })
    }
}

module.exports = { getAssignmentDropdownsController, createAssignmentController, getAllAssignmentsController, getAssignmentByIdController, getAssignmentByIdController, updateSalaryAssignmentController }