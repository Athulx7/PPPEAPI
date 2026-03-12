const { getSlryComponentDropdownData, getSlryComponentCalculationTypeDropdownData } = require("../Repositories/salary_structure/getComponentDropData")

async function getComponentDropDataController(req,res) {
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

async function getComponentCalculationTypeDropDataController(req,res) {
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

module.exports = { getComponentDropDataController, getComponentCalculationTypeDropDataController }