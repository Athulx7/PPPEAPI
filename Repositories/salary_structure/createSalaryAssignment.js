async function createAssignment(req) {
    const db = req.tenantDB
    const { user_code } = req.user

    const {
        type,
        targetId,
        structureId,
        effectiveDate,
        endDate,
        reason,
        status
    } = req.body

    const transaction = db.transaction()
    await transaction.begin()

    try {

        const check = await transaction.request()
            .input('target_code', targetId)
            .input('assignment_type', type)
            .query(`
                SELECT id FROM tbl_salary_structure_assignment
                WHERE target_code = @target_code
                  AND assignment_type = @assignment_type
                  AND status = 1
                  AND (end_date IS NULL OR end_date >= GETDATE())
            `)

        if (check.recordset.length) {
            throw new Error("Active assignment already exists for this target")
        }

        const result = await transaction.request()
            .input('assignment_type', type)
            .input('target_code', targetId)
            .input('structure_id', structureId)
            .input('effective_date', effectiveDate)
            .input('end_date', endDate || null)
            .input('reason', reason || null)
            .input('status', status === 'active' ? 1 : 0)
            .input('assigned_by', user_code)
            .query(`
                INSERT INTO tbl_salary_structure_assignment
                (
                    assignment_type,
                    target_code,
                    structure_id,
                    effective_date,
                    end_date,
                    reason,
                    status,
                    assigned_by,
                    created_at
                )
                OUTPUT INSERTED.*
                VALUES
                (
                    @assignment_type,
                    @target_code,
                    @structure_id,
                    @effective_date,
                    @end_date,
                    @reason,
                    @status,
                    @assigned_by,
                    GETDATE()
                )
            `)

        await transaction.commit()

        return result.recordset[0]

    } catch (err) {
        await transaction.rollback()
        throw err
    }
}

module.exports = { createAssignment }