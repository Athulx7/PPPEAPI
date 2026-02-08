const { getMainMenuData } = require("../../Repositories/menuitems/getMainMenuData");
const { getSearchMenu } = require("../../Repositories/menuitems/getSearchMenu");
const { getSideMenu, getSystemRoles } = require("../../Repositories/menuitems/getSideMenu")

async function MenuitemsController(req, res) {
    try {
        const result = await getSideMenu(req)

        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        });
    } catch (err) {
        console.error("MenuitemsController error:", err)

        return res.status(500).json({
            success: false,
            message: "Failed to fetch side menu"
        })
    }
}

async function getSystemRolesController(req, res) {
    try {
        const result = await getSystemRoles(req)

        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.error("getSystemRoles error:", err)

        return res.status(500).json({
            success: false,
            message: "Failed to fetch system roles"
        })
    }
}

async function getMainMenuDataController(req, res) {
    try {
        const result = await getMainMenuData(req)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result,
        })
    }
    catch (err) {
        console.log("error in getting main menus", err)
        return res.status(500).json({
            success: false,
            message: 'faild to get maian menus'
        })
    }
}

async function getSearchMenuController (req,res) {
    try{
        const result = await getSearchMenu(req)
        return res.status(200).json({
            success : true,
            message : "success",
            data : result
        })
    }
    catch(err){
        console.log("error in getting search result",err)
        return res.status(500).json({
            success : false,
            message : "faild to get search data"
        })
    }
}

module.exports = { MenuitemsController, getSystemRolesController, getMainMenuDataController,getSearchMenuController }