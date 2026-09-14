const { getUserProfileRepository, updateUserProfileRepository, changePasswordRepository } = require("../Repositories/UserProfile/userProfileRepo")

async function getUserProfileController(req, res) {
    try {
        const profileData = await getUserProfileRepository(req)
        return res.status(200).json({
            success: true,
            data: profileData
        })

    } catch (error) {
        console.error("Error in getUserProfileController:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to fetch user profile",
            error: error.message
        })
    }
}

async function updateUserProfileController(req, res) {
    try {
        const result = await updateUserProfileRepository(req, res)
        return res.status(200).json(result)
    } catch (error) {
        console.error("Error in updateUserProfileController:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to update user profile",
            error: error.message
        })
    }
}

async function changePasswordController(req, res) {
    try {
        const result = await changePasswordRepository(req)
        return res.status(200).json(result)
    } catch (error) {
        console.error("Error in changePasswordController:", error)
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to change password"
        })
    }
}

module.exports = { getUserProfileController, updateUserProfileController, changePasswordController }
