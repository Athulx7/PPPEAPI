require("dotenv").config({ path: "../.env" })
const { getTenantDB } = require("../DB/connectTenantDB")
const { connectToDb } = require("../DB/db_Connection")
const { getCompany } = require("../Repositories/login/authRepo")
const {
    handleCreateSession,
    handleGetSessions,
    handleGetSessionMessages,
    handleDeleteSession,
    handleChatbotQuery
} = require("../Controllers/chatbotController")
const sql = require("mssql")

async function runTest() {

    if (!process.env.GEMINI_API_KEY) {
        console.log("GEMINI_API_KEY not configured in .env. Test will run in offline mode.")
    } else {
        console.log("GEMINI_API_KEY found.")
    }

    try {
        await connectToDb()
    } catch (err) {
        console.error("Failed to connect to central database:", err.message)
        process.exit(1)
    }

    const testCompanyCode = "PPPA"
    console.log(`Resolving details for company code: "${testCompanyCode}" dynamically...`)
    let company
    try {
        company = await getCompany(testCompanyCode)
        if (!company) {
            console.error(` Company "${testCompanyCode}" is not registered or not active in the system.`)
            process.exit(1)
        }
    } catch (err) {
        console.error(" Error resolving company dynamically:", err.message)
        process.exit(1)
    }

    let tenantDB
    try {
        tenantDB = await getTenantDB(company.db_name, company.db_host, company.db_user, company.db_password)
    } catch (err) {
        console.error("Failed to connect to resolved tenant database:", err.message)
        process.exit(1)
    }

    let testSessionId = null

    const mockRequestResponse = (body, params = {}, roleCode = "HR", userCode = "EMP102") => {
        return new Promise((resolve, reject) => {
            const req = {
                body,
                params,
                user: {
                    user_code: userCode,
                    email: `${userCode.toLowerCase()}@example.com`,
                    role_code: roleCode,
                    role_name: roleCode === "EMPLOYEE" ? "Regular Employee" : "HR Admin",
                    company_name: company.company_name
                },
                companyCode: company.company_code,
                tenantDB
            }

            const res = {
                statusCode: 200,
                status: function (code) {
                    this.statusCode = code
                    return this
                },
                json: function (data) {
                    resolve({ statusCode: this.statusCode, data })
                }
            }

            return { req, res }
        })
    }

    const t1 = await new Promise(async (resolve) => {
        const req = {
            user: { user_code: "EMP102", role_code: "HR", company_name: company.company_name },
            companyCode: company.company_code,
            tenantDB
        }
        const res = {
            statusCode: 200,
            status: function (code) { this.statusCode = code; return this; },
            json: function (data) { resolve({ statusCode: this.statusCode, data }); }
        };
        await handleCreateSession(req, res)
    });

    if (t1.data.success) {
        testSessionId = t1.data.session.session_id
        console.log("Created Session ID:", testSessionId)
        console.log("Welcome Message Preview:", t1.data.messages[0].content.split("\n")[0])
    } else {
        console.error("Session creation failed:", t1.data)
        process.exit(1)
    }

    const t2 = await new Promise(async (resolve) => {
        const req = {
            user: { user_code: "EMP102" },
            tenantDB
        }
        const res = {
            statusCode: 200,
            status: function (code) { this.statusCode = code; return this; },
            json: function (data) { resolve({ statusCode: this.statusCode, data }); }
        }
        await handleGetSessions(req, res)
    })

    const t3 = await new Promise(async (resolve) => {
        const req = {
            body: { message: "Show all designations in this company", sessionId: testSessionId },
            user: { user_code: "EMP102", role_code: "HR", company_name: company.company_name },
            companyCode: company.company_code,
            tenantDB
        }
        const res = {
            statusCode: 200,
            status: function (code) { this.statusCode = code; return this; },
            json: function (data) { resolve({ statusCode: this.statusCode, data }); }
        }
        await handleChatbotQuery(req, res)
    })

    const t4 = await new Promise(async (resolve) => {
        const req = {
            params: { sessionId: testSessionId },
            tenantDB
        }
        const res = {
            statusCode: 200,
            status: function (code) { this.statusCode = code; return this; },
            json: function (data) { resolve({ statusCode: this.statusCode, data }); }
        }
        await handleGetSessionMessages(req, res)
    })
    t4.data.data.forEach((m) => {
        console.log(`- [${m.sender.toUpperCase()}]: "${m.content.substring(0, 80).replace(/\n/g, " ")}..."`);
    })

    const t5 = await new Promise(async (resolve) => {
        const req = {
            params: { sessionId: testSessionId },
            user: { user_code: "EMP102" },
            tenantDB
        }
        const res = {
            statusCode: 200,
            status: function (code) { this.statusCode = code; return this; },
            json: function (data) { resolve({ statusCode: this.statusCode, data }); }
        }
        await handleDeleteSession(req, res)
    })

    const t6 = await new Promise(async (resolve) => {
        const req = {
            user: { user_code: "EMP102" },
            tenantDB
        }
        const res = {
            statusCode: 200,
            status: function (code) { this.statusCode = code; return this; },
            json: function (data) { resolve({ statusCode: this.statusCode, data }); }
        }
        await handleGetSessions(req, res)
    })

    await sql.close()
}

runTest();
