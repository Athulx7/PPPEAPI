const { createChatDm } = require("../Repositories/Chat/createChatDm")
const { getChatMessages } = require("../Repositories/Chat/getChatMessages")
const { getChatRooms } = require("../Repositories/Chat/getChatRooms")
const { getFullEmpForChat } = require("../Repositories/Chat/getEmployeeData")

async function getFullemplopyeeDataController(req, res) {
    try {
        const result = await getFullEmpForChat(req, res)
        return res.status(200).json({
            success: true,
            message: "success",
            data: result
        })
    }
    catch (err) {
        console.log('error in getting Full emp data for chat', err)
        return res.status(500).json({
            success: false,
            message: "Failed to get employee data"
        })
    }
}

async function createChatDmController(req, res) {
    try {
        const result = await createChatDm(req, res)
        return res.status(200).json({
            success: true,
            message: "Chat room created",
            data: result
        })
    }
    catch (err) {
        console.log('error in creating DM chat room', err)
        return res.status(500).json({
            success: false,
            message: "Failed to create DM chat room"
        })
    }
}

async function getChatRoomsController(req, res) {
    try {
        const result = await getChatRooms(req, res)
        return res.status(200).json({
            success: true,
            message: "Chat rooms retrieved",
            data: result
        })
    }
    catch (err) {
        console.log('error in retrieving chat rooms', err)
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve chat rooms"
        })
    }
}

async function getChatMessagesController(req, res) {
    try {
        const result = await getChatMessages(req, res)
        return res.status(200).json({
            success: true,
            message: "Chat messages retrieved",
            data: result
        })
    }
    catch (err) {
        console.log('error in retrieving chat messages', err)
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve chat messages"
        })
    }
}

module.exports = { getFullemplopyeeDataController, createChatDmController, getChatRoomsController, getChatMessagesController }