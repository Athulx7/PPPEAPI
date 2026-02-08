const { getDropdownData } = require("../../Repositories/master/getDropdownData")
const { getMasterContents } = require("../../Repositories/master/getMasterContents")
const { getMasterById } = require("../../Repositories/master/getMasterDataById")
const { getMasterTableList } = require("../../Repositories/master/getMasterTableList")
const { saveMasterData } = require("../../Repositories/master/saveMasterData")

async function getMasterTableLIistController(req, res) {
    try {
        const result = await getMasterTableList(req)

        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('error in the get tbale list', err)
        return res.status(500).json({
            success: false,
            message: "Failed to fetch master table list"
        })
    }
}

async function getMasterContentController(req, res) {
    try {
        const result = await getMasterContents(req)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('error in the get master contents', err)
        return res.status(500).json({
            success: false,
            message: "Failed to fetch master contents"
        })
    }
}

async function getMasterDataByIDController(req, res) {
    try {
        const result = await getMasterById(req);

        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        });
    } catch (err) {
        console.error("Error fetching master by id", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to fetch record"
        });
    }
}

async function getDropdonwDataController(req, res) {
    try {
        const result = await getDropdownData(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('error in getting dropdown data', err)
        return res.status(500).json({
            success: false,
            message: "Failed to fetch dropdown data"
        })
    }
}

async function saveMasterController(req, res) {
    try {
        const result = await saveMasterData(req, res)
        return res.status(200).json({
            success: true,
            message: "Master data saved successfully",
            data: result
        })
    }
    catch (err) {
        console.log('error in saving the master data', err)
        return res.status(500).json({
            success: false,
            message: 'failed to save the master data'
        })
    }
}

module.exports = { getMasterTableLIistController, getMasterContentController, getMasterDataByIDController, getDropdonwDataController, saveMasterController }