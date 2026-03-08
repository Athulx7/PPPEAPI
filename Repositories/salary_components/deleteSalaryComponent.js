async function deleteSalaryComponent(req) {

    const db = req.tenantDB
    const { id } = req.params

    await db.request()
        .input("id", id)
        .query(`
            DELETE FROM tbl_salary_components
            WHERE id=@id
        `)

    return true
}

module.exports = { deleteSalaryComponent }