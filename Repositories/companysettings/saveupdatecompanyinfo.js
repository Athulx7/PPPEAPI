const sql = require("mssql")

async function saveUpdateCompanyInfo(req) {
    const db = req.tenantDB
    const adminDB = req.adminDB
    const { company_code } = req.user
    const data = req.body
    console.log('dataata',data)

    const transaction = new sql.Transaction(db)
    await transaction.begin()

    try {
        const request = new sql.Request(transaction)

        const existing = await request.query(`
            SELECT TOP 1 company_settings_id
            FROM tbl_company_settings
        `)

        request
            .input("company_name", sql.VarChar, data.company_name)
            .input("legal_name", sql.VarChar, data.legal_name)
            .input("registration_number", sql.VarChar, data.registration_number)
            .input("founded_date", sql.Date, data.founded_date || null)
            .input("industry_type", sql.VarChar, data.industry_type)
            .input("company_size", sql.VarChar, data.company_size)
            .input("company_description", sql.VarChar, data.company_description)
            .input("primary_email", sql.VarChar, data.primary_email)
            .input("secondary_email_hr", sql.VarChar, data.secondary_email_hr)
            .input("phone_number", sql.VarChar, data.phone_number)
            .input("mobile_number", sql.VarChar, data.mobile_number)
            .input("fax_number", sql.VarChar, data.fax_number)
            .input("head_office_address", sql.VarChar, data.head_office_address)
            .input("city", sql.VarChar, data.city)
            .input("state", sql.VarChar, data.state)
            .input("country", sql.VarChar, data.country)
            .input("postal_code", sql.VarChar, data.postal_code)
            .input("default_currency", sql.VarChar, data.default_currency)
            .input("tax_id", sql.VarChar, data.tax_id)
            .input("fy_start_month", sql.VarChar, data.fy_start_month || null)
            .input("fy_end_month", sql.VarChar, data.fy_end_month || null)
            .input("bank_name", sql.VarChar, data.bank_name)
            .input("account_number", sql.VarChar, data.account_number)
            .input("bank_branch", sql.VarChar, data.bank_branch)
            .input("ifsc_code", sql.VarChar, data.ifsc_code)
            .input("swift_code", sql.VarChar, data.swift_code)
            .input("website", sql.VarChar, data.website)
            .input("company_domain", sql.VarChar, data.company_domain)
            .input("linkedin_url", sql.VarChar, data.linkedin_url)
            .input("twitter_url", sql.VarChar, data.twitter_url);

        if (existing.recordset.length) {
            await request.query(`
                UPDATE tbl_company_settings
                SET
                    company_name = @company_name,
                    legal_name = @legal_name,
                    registration_number = @registration_number,
                    founded_date = @founded_date,
                    industry_type = @industry_type,
                    company_size = @company_size,
                    company_description = @company_description,
                    primary_email = @primary_email,
                    secondary_email_hr = @secondary_email_hr,
                    phone_number = @phone_number,
                    mobile_number = @mobile_number,
                    fax_number = @fax_number,
                    head_office_address = @head_office_address,
                    city = @city,
                    state = @state,
                    country = @country,
                    postal_code = @postal_code,
                    default_currency = @default_currency,
                    tax_id = @tax_id,
                    fy_start_month = @fy_start_month,
                    fy_end_month = @fy_end_month,
                    bank_name = @bank_name,
                    account_number = @account_number,
                    bank_branch = @bank_branch,
                    ifsc_code = @ifsc_code,
                    swift_code = @swift_code,
                    website = @website,
                    company_domain = @company_domain,
                    linkedin_url = @linkedin_url,
                    twitter_url = @twitter_url
            `);
        } else {
            await request.query(`
                INSERT INTO tbl_company_settings (
                    company_name, legal_name, registration_number, founded_date,
                    industry_type, company_size, company_description,
                    primary_email, secondary_email_hr,
                    phone_number, mobile_number, fax_number,
                    head_office_address, city, state, country, postal_code,
                    default_currency, tax_id, fy_start_month, fy_end_month,
                    bank_name, account_number, bank_branch, ifsc_code, swift_code,
                    website, company_domain, linkedin_url, twitter_url
                )
                VALUES (
                    @company_name, @legal_name, @registration_number, @founded_date,
                    @industry_type, @company_size, @company_description,
                    @primary_email, @secondary_email_hr,
                    @phone_number, @mobile_number, @fax_number,
                    @head_office_address, @city, @state, @country, @postal_code,
                    @default_currency, @tax_id, @fy_start_month, @fy_end_month,
                    @bank_name, @account_number, @bank_branch, @ifsc_code, @swift_code,
                    @website, @company_domain, @linkedin_url, @twitter_url
                )
            `)
        }
        // await adminDB.request()
        //     .input("company_name", sql.VarChar, data.company_name)
        //     .input("company_code", sql.VarChar, company_code)
        //     .query(`
        //         UPDATE PPP_AdminDB.dbo.tbl_companies
        //         SET company_name = @company_name
        //         WHERE company_code = @company_code
        //     `)

        await transaction.commit()

        return { success: true }

    } catch (err) {
        await transaction.rollback()
        throw err
    }
}

module.exports = { saveUpdateCompanyInfo }