const { createSalaryStructure, updateSalaryStructure } = require("../Repositories/salary_structure/createSalaryStructure")
const { getSlryComponentDropdownData, getSlryComponentCalculationTypeDropdownData, getDropdownComponentType } = require("../Repositories/salary_structure/getComponentDropData")
const { getSalaryStructureById } = require("../Repositories/salary_structure/getSalaryStructureById")
const { getSalaryStructureList } = require("../Repositories/salary_structure/getSavedStructreForListPage")

async function getComponentDropDataController(req, res) {
    try {
        const data = await getSlryComponentDropdownData(req)
        return res.json({
            success: true,
            message: "Dropdown data retrieved",
            data: data
        })
    }
    catch (err) {
        console.log(err)
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve dropdown data"
        })
    }
}

async function getComponentCalculationTypeDropDataController(req, res) {
    try {
        const data = await getSlryComponentCalculationTypeDropdownData(req)
        return res.json({
            success: true,
            message: "Dropdown data retrieved",
            data: data
        })
    }
    catch (err) {
        console.log(err)
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve dropdown data"
        })
    }
}

async function getDropdownComponentTypeController(req, res) {
    try {
        const data = await getDropdownComponentType(req)
        return res.json({
            success: true,
            message: "Dropdown data retrieved",
            data: data
        })
    }
    catch (err) {
        console.log(err)
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve dropdown data"
        })
    }
}

async function createSalaryStructueController(req, res) {
    try {
        const data = await createSalaryStructure(req)

        if (!data.success) {
            return res.status(400).json(data)
        }

        return res.json({
            success: true,
            message: "Salary structure created successfully",
            data: data
        })
    }
    catch (err) {
        console.log(err)
        return res.status(500).json({
            success: false,
            message: "Failed to create salary structure"
        })
    }
}

async function updateSalaryStructureController(req, res) {
    try {
        const data = await updateSalaryStructure(req)

        return res.json({
            success: true,
            message: "Salary structure updated successfully",
            data
        })
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            success: false,
            message: "Failed to update salary structure"
        })
    }
}

async function getSavedStructuresListController(req, res) {
    try {
        const data = await getSalaryStructureList(req)
        return res.json({
            success: true,
            message: "Saved structures retrieved",
            data: data
        })
    }
    catch (err) {
        console.log(err)
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve saved structures"
        })
    }
}

async function getSalaryStructureByIdController(req, res) {
    try {
        const rows = await getSalaryStructureById(req)

        if (!rows.length) {
            return res.status(404).json({ success: false })
        }

        const first = rows[0]

        const structure = {
            id: first.id,
            name: first.structure_name,
            code: first.structure_code,
            description: first.description,
            effectiveDate: first.effective_date,
            status: first.status ? 'active' : 'inactive',
            components: rows.map(r => ({
                componentId: r.component_id,
                component_code: r.component_code,
                component_name: r.component_name,
                type_code: r.type_code,
                calc_code: r.calc_code,
                fixed_amount: r.fixed_amount,
                percentage_value: r.percentage_value,
                base_component_code: r.base_component_code,
                formula_expression: r.formula_expression
            }))
        }

        return res.json({ success: true, data: structure })

    } catch (err) {
        console.log(err)
        return res.status(500).json({ success: false })
    }
}

module.exports = { getComponentDropDataController, getComponentCalculationTypeDropDataController, getDropdownComponentTypeController, createSalaryStructueController, updateSalaryStructureController, getSavedStructuresListController, getSalaryStructureByIdController }