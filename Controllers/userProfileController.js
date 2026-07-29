const { getUserProfileRepository, updateUserProfileRepository } = require("../Repositories/UserProfile/userProfileRepo")

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

module.exports = { getUserProfileController, updateUserProfileController }
