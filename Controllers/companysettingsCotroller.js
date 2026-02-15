const { getCompanyINforepo } = require("../Repositories/companysettings/getCompnayInfo")
const { saveUpdateCompanyInfo } = require("../Repositories/companysettings/saveupdatecompanyinfo")

async function saveUpdaetCOmpanySettingsController(req, res) {
    try {
        const result = await saveUpdateCompanyInfo(req)

        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.error("error in save cmapny info", err)

        return res.status(500).json({
            success: false,
            message: "Failed to Save company info"
        })
    }
}

async function getcompanyinfoCOntrller (req,res) {
    try{
        const result = await getCompanyINforepo(req,res)
        return res.status(200).json({
            success : true,
            message : "success",
            data : result
        })
    }
    catch(err) {
        console.log('error in getting company info',err)
        return res.status(500).json({
            success : false,
            message : "Failed to get company info"
        })
    }
}

module.exports = { saveUpdaetCOmpanySettingsController, getcompanyinfoCOntrller }