const { getEmpMasterControls, getEmpMstDropdwonData } = require("../Repositories/emp_master/getEmpMasterControls")

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


module.exports = { getEMpMasterCntrlsController,getEmpMstDropdwonDataController, }