const { getMasterTableList } = require("../../Repositories/master/getMasterTableList")

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

module.exports = { getMasterTableLIistController }