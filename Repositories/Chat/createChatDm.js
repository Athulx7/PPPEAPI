async function createChatDm(req, res) {
    const { user_code } = req.user
    const { target_emp_code } = req.body
    const db = req.tenantDB

    const request = db.request()

    request.input('user_code', user_code)

    const room = await request.query(`
        INSERT INTO chat_rooms (room_type, created_by)
        OUTPUT INSERTED.*
        VALUES ('dm', @user_code)
    `)

    const roomId = room.recordset[0].id

    const request2 = db.request()
    request2.input('roomId', roomId)
    request2.input('user_code', user_code)
    request2.input('target', target_emp_code)

    await request2.query(`
        INSERT INTO chat_room_members (room_id, emp_code)
        VALUES (@roomId, @user_code),
               (@roomId, @target)
    `)

    return res.json({ success: true, data: room.recordset[0] })
}

module.exports = { createChatDm }