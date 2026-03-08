const sql = require("mssql")

async function saveSalaryComponents(req) {

    const db = req.tenantDB
    const data = req.body

    try {

        if (!data || Object.keys(data).length === 0) {
            throw new Error("No data received for saving")
        }

        const request = db.request()
        const columns = []
        const values = []

        Object.keys(data).forEach((key) => {

            if (data[key] !== undefined) {
                columns.push(key)
                values.push(`@${key}`)
                request.input(key, data[key])
            }
        })

        if (columns.length === 0) {
            throw new Error("No valid fields provided")
        }

        const query = `
            INSERT INTO tbl_salary_components
            (${columns.join(",")}, created_at)
            VALUES
            (${values.join(",")}, GETDATE())
        `

        const result = await request.query(query)
        return result
    }
    catch (err) {
        console.log("Repository error in saveSalaryComponents:", err)
        throw err
    }
}

async function updateSalaryComponent(req) {

    const db = req.tenantDB
    const data = req.body

    const id = data.id

    delete data.id

    const fields = Object.keys(data)
        .map(key => `${key}=@${key}`)
        .join(",")

    const request = db.request()

    Object.keys(data).forEach(key => {
        request.input(key, data[key])
    })

    request.input("id", id)

    const query = `
        UPDATE tbl_salary_components
        SET ${fields},
        updated_at = GETDATE()
        WHERE id=@id
    `

    await request.query(query)

    return true
}

module.exports = { saveSalaryComponents, updateSalaryComponent }