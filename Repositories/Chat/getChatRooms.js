async function getChatRooms(req, res) {
    const { emp_code } = req.user
    const db = req.tenantDB

    const result = await db.query(`
        SELECT 
    cr.id, 
    cr.room_type, 
    cr.name,
    crm.last_read_at,

    -- other user for DM
    e.first_name + ' ' + e.last_name AS other_name,
    e.emp_code AS other_emp_code,

    lm.content AS last_message,
    lm.sent_at AS last_message_at

FROM chat_rooms cr

JOIN chat_room_members crm 
    ON crm.room_id = cr.id

-- get other user in DM
LEFT JOIN chat_room_members crm2 
    ON crm2.room_id = cr.id 
    AND crm2.emp_code != 'ADM001'

LEFT JOIN tbl_employee_mst e 
    ON e.emp_code = crm2.emp_code

-- get last message using OUTER APPLY
OUTER APPLY (
    SELECT TOP 1 content, sent_at
    FROM chat_messages
    WHERE room_id = cr.id
    ORDER BY sent_at DESC
) lm

WHERE crm.emp_code = 'ADM001'
AND cr.is_archived = 0
    `, { emp_code })

    return  result.recordset
}

module.exports = { getChatRooms }