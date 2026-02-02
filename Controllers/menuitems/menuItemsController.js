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

module.exports = { MenuitemsController, getSystemRolesController }