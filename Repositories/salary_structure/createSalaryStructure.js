const sql = require("mssql")

async function createSalaryStructure(req) {
    const db = req.tenantDB
    const { user_code } = req.user

    const {
        structureCode,
        structureName,
        description,
        effectiveDate,
        status,
        components
    } = req.body

    const transaction = new sql.Transaction(db)
    await transaction.begin()

    try {
        const request = new sql.Request(transaction)

        const duplicate = await request
            .input("structure_code", sql.VarChar, structureCode)
            .query(`
                SELECT id FROM tbl_salary_structure
                WHERE structure_code = @structure_code
            `)

        if (duplicate.recordset.length > 0) {
            await transaction.rollback()
            return {
                success: false,
                message: "Structure code already exists"
            }
        }

        const structureRes = await request
            .input("structure_name", sql.VarChar, structureName)
            .input("description", sql.VarChar, description)
            .input("effective_date", sql.Date, effectiveDate)
            .input("status", sql.Bit, status === "active" ? 1 : 0)
            .input("created_by", sql.VarChar, user_code)
            .query(`
                INSERT INTO tbl_salary_structure
                (structure_code, structure_name, description, effective_date, status, created_by)
                OUTPUT INSERTED.id
                VALUES
                (@structure_code, @structure_name, @description, @effective_date, @status, @created_by)
            `)

        const structure_id = structureRes.recordset[0].id

        for (let i = 0; i < components.length; i++) {
            const comp = components[i]

            const compReq = new sql.Request(transaction)

            let baseComponentId = null

            if (comp.base_component_code) {
                const baseRes = await new sql.Request(transaction)
                    .input("code", sql.VarChar, comp.base_component_code)
                    .query(`
                        SELECT id FROM tbl_salary_components
                        WHERE component_code = @code
                    `)

                if (baseRes.recordset.length > 0) {
                    baseComponentId = baseRes.recordset[0].id
                }
            }

            await compReq
                .input("structure_id", sql.Int, structure_id)
                .input("component_id", sql.Int, comp.componentId)
                .input("calc_code", sql.VarChar, comp.calc_code)
                .input("fixed_amount", sql.Decimal(18, 2), comp.fixed_amount ?? null)
                .input("percentage_value", sql.Decimal(10, 2), comp.percentage_value ?? null)
                .input("base_component_id", sql.Int, baseComponentId)
                .input("formula_expression", sql.VarChar, comp.formula_expression ?? null)
                .input("component_order", sql.Int, i + 1)
                .query(`
                    INSERT INTO tbl_salary_structure_components
                    (
                        structure_id,
                        component_id,
                        calc_code,
                        fixed_amount,
                        percentage_value,
                        base_component_id,
                        formula_expression,
                        component_order
                    )
                    VALUES
                    (
                        @structure_id,
                        @component_id,
                        @calc_code,
                        @fixed_amount,
                        @percentage_value,
                        @base_component_id,
                        @formula_expression,
                        @component_order
                    )
                `)
        }

        await transaction.commit()

        return {
            success: true,
            message: "Salary structure created successfully",
            structure_id
        }

    } catch (err) {
        await transaction.rollback()
        throw err
    }
}

async function updateSalaryStructure(req) {
    const db = req.tenantDB
    const { user_code } = req.user
    const { id } = req.params

    const {
        structureCode,
        structureName,
        description,
        effectiveDate,
        status,
        components
    } = req.body

    const transaction = db.transaction()
    await transaction.begin()

    try {
        await transaction.request()
            .input('id', id)
            .input('structure_code', structureCode)
            .input('structure_name', structureName)
            .input('description', description)
            .input('effective_date', effectiveDate)
            .input('status', status === 'active' ? 1 : 0)
            .input('updated_by', user_code)
            .query(`
                UPDATE tbl_salary_structure
                SET
                    structure_code = @structure_code,
                    structure_name = @structure_name,
                    description = @description,
                    effective_date = @effective_date,
                    status = @status,
                    updated_by = @updated_by,
                    updated_at = GETDATE()
                WHERE id = @id
            `)

        await transaction.request()
            .input('structure_id', id)
            .query(`
                DELETE FROM tbl_salary_structure_components
                WHERE structure_id = @structure_id
            `)

        for (let i = 0; i < components.length; i++) {
            const comp = components[i]

            let baseComponentId = null

            if (comp.base_component_code) {
                const baseRes = await transaction.request()
                    .input('code', comp.base_component_code)
                    .query(`
                        SELECT id FROM tbl_salary_components
                        WHERE component_code = @code
                    `)

                if (baseRes.recordset.length) {
                    baseComponentId = baseRes.recordset[0].id
                }
            }

            await transaction.request()
                .input('structure_id', id)
                .input('component_id', comp.componentId)
                .input('calc_code', comp.calc_code)
                .input('fixed_amount', comp.fixed_amount || null)
                .input('percentage_value', comp.percentage_value || null)
                .input('formula_expression', comp.formula_expression || null)
                .input('base_component_id', baseComponentId)
                .input('component_order', i + 1)
                .query(`
                    INSERT INTO tbl_salary_structure_components
                    (
                        structure_id,
                        component_id,
                        calc_code,
                        fixed_amount,
                        percentage_value,
                        base_component_id,
                        formula_expression,
                        component_order
                    )
                    VALUES
                    (
                        @structure_id,
                        @component_id,
                        @calc_code,
                        @fixed_amount,
                        @percentage_value,
                        @base_component_id,
                        @formula_expression,
                        @component_order
                    )
                `)
        }

        await transaction.commit()

        return { success: true }

    } catch (err) {
        await transaction.rollback()
        throw err
    }
}

module.exports = { createSalaryStructure, updateSalaryStructure }