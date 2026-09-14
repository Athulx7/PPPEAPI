const { getAllMyLeaveDataRepo } = require("../Repositories/LeaveMyLeaves/getAllMyLeaveData")
const { getLeaveHistoryDataRepo } = require("../Repositories/LeaveMyLeaves/getLeaveHistoryData")
const { getLeaveAnalyticsDataRepo } = require("../Repositories/LeaveMyLeaves/getLeaveAnalyticsData")

async function getAllMyLeavesDataController(req, res) {
    try {
        const result = await getAllMyLeaveDataRepo(req)
        return res.status(200).json({ success: true, message: "success", data: result })
    } catch (err) {
        console.log("getAllMyLeavesDataController:", err)
        return res.status(500).json({ success: false, message: "Failed to fetch allocation" })
    }
}

async function getLeaveHistoryController(req, res) {
    try {
        const result = await getLeaveHistoryDataRepo(req)
        return res.status(200).json({ success: true, message: "success", data: result.data || [] })
    } catch (err) {
        console.log("getLeaveHistoryController error:", err)
        return res.status(500).json({ success: false, message: "Failed to fetch leave history" })
    }
}

async function getLeaveAnalyticsController(req, res) {
    try {
        const result = await getLeaveAnalyticsDataRepo(req)
        return res.status(200).json({ success: true, message: "success", data: result })
    } catch (err) {
        console.log("getLeaveAnalyticsController error:", err)
        return res.status(500).json({ success: false, message: "Failed to fetch leave analytics" })
    }
}

module.exports = { getAllMyLeavesDataController, getLeaveHistoryController, getLeaveAnalyticsController }