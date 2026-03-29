async function getChatMessages(req) {
    const { roomId } = req.params
    const { user_code } = req.user
    const { before, limit = 40 } = req.query

    const db = req.tenantDB

    const check = await db.request()
        .input('roomId', roomId)
        .input('user_code', user_code)
        .query(`
            SELECT 1 FROM chat_room_members
            WHERE room_id = @roomId AND emp_code = @user_code
        `)

    if (!check.recordset.length) {
        throw new Error("Unauthorized")
    }

    const request = db.request()
    request.input('roomId', roomId)
    request.input('limit', parseInt(limit))

    let whereClause = `cm.room_id = @roomId`

    if (before) {
        request.input('before', before)
        whereClause += ` AND cm.sent_at < @before`
    }

    const query = `
        SELECT *
        FROM (
            SELECT TOP (@limit)
                cm.*,
                ISNULL(e.first_name + ' ' + e.last_name, 'HRMS Bot') AS sender_name
            FROM chat_messages cm
            LEFT JOIN tbl_employee_mst e 
                ON e.emp_code = cm.sender_code
            WHERE ${whereClause}
            ORDER BY cm.sent_at DESC
        ) AS latestMessages
        ORDER BY sent_at ASC 
    `

    const result = await request.query(query)

    return result.recordset
}

module.exports = { getChatMessages }