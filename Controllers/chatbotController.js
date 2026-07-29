const TABLE_REGISTRY = require("../tableRegistry")
const https = require("https")
const sql = require("mssql")

function callGemini(prompt, apiKey) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            contents: [
                {
                    parts: [
                        { text: prompt }
                    ]
                }
            ]
        });

        const options = {
            hostname: "generativelanguage.googleapis.com",
            port: 443,
            path: `/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": data.length
            }
        }

        const req = https.request(options, (res) => {
            let body = ""
            res.on("data", (chunk) => {
                body += chunk
            });
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(body)
                    if (parsed.error) {
                        return reject(new Error(parsed.error.message || "Gemini API error"))
                    }
                    if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content && parsed.candidates[0].content.parts[0]) {
                        resolve(parsed.candidates[0].content.parts[0].text);
                    } else {
                        reject(new Error("Invalid response structure from Gemini API"));
                    }
                } catch (e) {
                    reject(new Error("Failed to parse Gemini response: " + e.message));
                }
            });
        });

        req.on("error", (e) => {
            reject(e)
        })

        req.write(data)
        req.end()
    })
}

function buildWelcome(role, tenant, firstName) {
    const hour = new Date().getHours()
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
    const name = firstName || "User"

    const roleGreeting = {
        HR: `As an **HR Administrator** for **${tenant}**, you can query company-wide reports, check employee designations, check department counts, or review and approve pending leave requests.`,
        ADMIN: `As a **System Administrator** for **${tenant}**, you have full access to view department breakdown reports, active designation list, employee directory, and control system flows.`,
        MANAGER: `As a **Manager** for **${tenant}**, you can query your team's details, check pending approvals, and view standard holidays.`,
        EMPLOYEE: `As an **Employee** at **${tenant}**, you can look up your own details: leave balances, reporting manager, attendance rate, current month's payslip breakdown, and upcoming holidays.`
    }

    const roleInstructions = {
        HR: [
            "• Try asking: _\"Show all pending leave requests\"_",
            "• Try asking: _\"How many employees are in each department?\"_",
            "• Try asking: _\"List all employees in Sales\"_"
        ],
        ADMIN: [
            "• Try asking: _\"Show designations in this company\"_",
            "• Try asking: _\"How many employees are in each department?\"_",
            "• Try asking: _\"List all employees in Engineering\"_"
        ],
        EMPLOYEE: [
            "• Try asking: _\"How many leaves are pending for me?\"_",
            "• Try asking: _\"What are the upcoming holidays?\"_",
            "• Try asking: _\"Who is my reporting manager?\"_"
        ],
        MANAGER: [
            "• Try asking: _\"Show pending leave requests from my team\"_",
            "• Try asking: _\"List employees in my department\"_"
        ]
    };

    const activeGreeting = roleGreeting[role] || roleGreeting.EMPLOYEE;
    const activeInstructions = roleInstructions[role] || roleInstructions.EMPLOYEE;

    const lines = [
        `**${greeting}, ${name}! 👋 Welcome to your AI Assistant.**`,
        "",
        activeGreeting,
        "",
        "**Here are some things you can ask me:**",
        ...activeInstructions,
        "",
        "Feel free to type casual questions or tap any quick suggestion chip below!"
    ];

    return lines.join("\n");
}

async function handleCreateSession(req, res) {
    try {
        const tenantDB = req.tenantDB
        if (!tenantDB) {
            return res.status(400).json({ success: false, message: "Tenant database connection not resolved" })
        }

        const empCode = req.user.user_code
        const role = (req.user.role_code || "EMPLOYEE").toUpperCase()
        const companyName = req.user.company_name || "Company"

        let firstName = "User"
        try {
            const userRes = await tenantDB.request().input("empCode", sql.VarChar, empCode).query("SELECT first_name, last_name FROM tbl_employee_mst WHERE emp_code = @empCode")
            if (userRes.recordset.length > 0) {
                firstName = userRes.recordset[0].first_name
                const lastName = userRes.recordset[0].last_name
                if (lastName) {
                    firstName += " " + lastName
                }
            }
        } catch (dbErr) {
            console.error("Error querying user name:", dbErr)
        }

        const sessionId = "session-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9)
        const welcomeContent = buildWelcome(role, companyName, firstName)
        const defaultTitle = "Active Assistant Session"

        await tenantDB.request()
            .input("sessionId", sql.VarChar, sessionId)
            .input("empCode", sql.VarChar, empCode)
            .input("title", sql.NVarChar, defaultTitle)
            .query("INSERT INTO tbl_chatbot_sessions (session_id, emp_code, title) VALUES (@sessionId, @empCode, @title)")

        await tenantDB.request()
            .input("sessionId", sql.VarChar, sessionId)
            .input("sender", sql.VarChar, "bot")
            .input("content", sql.NVarChar, welcomeContent)
            .query("INSERT INTO tbl_chatbot_messages (session_id, sender, content) VALUES (@sessionId, @sender, @content)")

        return res.status(200).json({
            success: true,
            session: { session_id: sessionId, title: defaultTitle },
            messages: [{ sender: "bot", content: welcomeContent, timestamp: new Date() }]
        })
    } catch (err) {
        console.error("Error creating session:", err);
        return res.status(500).json({ success: false, message: "Failed to create chatbot session" });
    }
}

async function handleGetSessions(req, res) {
    try {
        const tenantDB = req.tenantDB
        if (!tenantDB) {
            return res.status(400).json({ success: false, message: "Tenant database connection not resolved" })
        }

        const empCode = req.user.user_code
        const result = await tenantDB.request()
            .input("empCode", sql.VarChar, empCode)
            .query("SELECT session_id, title, created_at, updated_at FROM tbl_chatbot_sessions WHERE emp_code = @empCode ORDER BY updated_at DESC")

        return res.status(200).json({ success: true, data: result.recordset })
    } catch (err) {
        console.error("Error retrieving sessions:", err)
        return res.status(500).json({ success: false, message: "Failed to retrieve chatbot sessions" })
    }
}

async function handleGetSessionMessages(req, res) {
    try {
        const tenantDB = req.tenantDB
        if (!tenantDB) {
            return res.status(400).json({ success: false, message: "Tenant database connection not resolved" })
        }

        const { sessionId } = req.params
        const result = await tenantDB.request()
            .input("sessionId", sql.VarChar, sessionId)
            .query("SELECT message_id, sender, content, timestamp FROM tbl_chatbot_messages WHERE session_id = @sessionId ORDER BY timestamp ASC")

        return res.status(200).json({ success: true, data: result.recordset })
    } catch (err) {
        console.error("Error retrieving session messages:", err)
        return res.status(500).json({ success: false, message: "Failed to retrieve chatbot messages" })
    }
}

async function handleDeleteSession(req, res) {
    try {
        const tenantDB = req.tenantDB
        if (!tenantDB) {
            return res.status(400).json({ success: false, message: "Tenant database connection not resolved" })
        }

        const { sessionId } = req.params
        const empCode = req.user.user_code

        await tenantDB.request()
            .input("sessionId", sql.VarChar, sessionId)
            .input("empCode", sql.VarChar, empCode)
            .query("DELETE FROM tbl_chatbot_sessions WHERE session_id = @sessionId AND emp_code = @empCode")

        return res.status(200).json({ success: true, message: "Session deleted successfully" })
    } catch (err) {
        console.error("Error deleting session:", err)
        return res.status(500).json({ success: false, message: "Failed to delete chatbot session" })
    }
}

async function handleChatbotQuery(req, res) {
    try {
        const { message, sessionId } = req.body
        if (!message) {
            return res.status(400).json({ success: false, message: "Message is required" })
        }

        const tenantDB = req.tenantDB
        if (!tenantDB) {
            return res.status(400).json({ success: false, message: "Tenant database connection not resolved" })
        }

        const empCode = req.user.user_code
        const role = (req.user.role_code || "EMPLOYEE").toUpperCase()
        const companyName = req.user.company_name || "Company"

        let activeSessionId = sessionId
        if (!activeSessionId) {
            activeSessionId = "session-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9)
            await tenantDB.request()
                .input("sessionId", sql.VarChar, activeSessionId)
                .input("empCode", sql.VarChar, empCode)
                .input("title", sql.NVarChar, "Active Assistant Session")
                .query("INSERT INTO tbl_chatbot_sessions (session_id, emp_code, title) VALUES (@sessionId, @empCode, @title)")
        }

        await tenantDB.request()
            .input("sessionId", sql.VarChar, activeSessionId)
            .input("sender", sql.VarChar, "user")
            .input("content", sql.NVarChar, message)
            .query("INSERT INTO tbl_chatbot_messages (session_id, sender, content) VALUES (@sessionId, @sender, @content)")

        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            console.warn("⚠️ GEMINI_API_KEY is not configured in .env file.");
            const offlineReply = `⚠️ **AI Chatbot is in Offline Mode**\n\nTo enable dynamic database queries, please add \`GEMINI_API_KEY\` to your backend \`.env\` file.\n\n*Here are the tables registered that can be queried once configured:*\n- **Employees**: \`tbl_employee_mst\`\n- **Departments**: \`tbl_department_mst\`\n- **Designations**: \`tbl_designation_mst\``
            
            await tenantDB.request()
                .input("sessionId", sql.VarChar, activeSessionId)
                .input("sender", sql.VarChar, "bot")
                .input("content", sql.NVarChar, offlineReply)
                .query("INSERT INTO tbl_chatbot_messages (session_id, sender, content) VALUES (@sessionId, @sender, @content)")

            return res.status(200).json({ success: true, reply: offlineReply })
        }

        const userContext = `Current User Context:
- Employee Code (emp_code): ${empCode}
- Email: ${req.user.email || "Unknown"}
- Role: ${role}`;

        const schemaText = JSON.stringify(TABLE_REGISTRY, null, 2)
        let roleRulesText = ""
        if (role === "ADMIN" || role === "HR") {
            roleRulesText = `User Role permissions: UNRESTRICTED. The user has HR/Admin privileges. They are permitted to run aggregate queries, departmental headcounts, lists of all staff, designations, and all details.`
        } else if (role === "MANAGER") {
            roleRulesText = `User Role permissions: DEPT_RESTRICTED. The user is a Manager. They can view general department list and designation list. They can also search or view employees reporting to them or in their department.`
        } else {
            roleRulesText = `User Role permissions: SELF_ONLY. The user is a regular Employee. They are STRICTLY RESTRICTED to querying details about themselves only.
- Any SELECT query from tbl_employee_mst MUST contain a WHERE filter matching the user's emp_code: emp_code = '${empCode}'.
- They are NOT allowed to list other employees, view other employees' records, or see total counts of departments.
- If the user asks for list of all staff, company-wide headcounts, or information about other employees, return an empty SQL query: { "sql": "" }.`;
        }

        const sqlPrompt = `You are a Microsoft SQL Server (T-SQL) expert database assistant for an HRMS.
Translate the user's natural language question into a single, valid, read-only SELECT query.

Database Schema:
${schemaText}

${userContext}

Rules:
1. ONLY return a JSON object with a single key "sql" containing the query.
   Example: { "sql": "SELECT COUNT(*) FROM tbl_employee_mst" }
2. Do NOT wrap the response in markdown code blocks like \`\`\`json. Return it as plain text.
3. The query MUST be a read-only SELECT statement. Do not use INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, EXEC, or write operations.
4. Use ONLY the tables and columns defined in the schema.
5. In tbl_employee_mst, default to filtering by "is_active = 1" unless the user asks for inactive employees.
6. ${roleRulesText}
7. The user may ask questions about themselves (e.g., "my profile", "who is my manager"). Use the provided user context to filter by the user's emp_code.
8. Pay attention to relationships. For example, tbl_employee_mst contains department_code (tbl_department_mst.depart_code) and designation_code (tbl_designation_mst.desig_code). Join tables if necessary to return user-friendly names (e.g., depart_name, desig_name) instead of codes.
9. If the user asks something unrelated to these tables or unauthorized under their role, return an empty SQL string: { "sql": "" }

User Question: "${message}"`

        let translationResultText = await callGemini(sqlPrompt, apiKey)
        translationResultText = translationResultText.trim()
        
        if (translationResultText.startsWith("```")) {
            translationResultText = translationResultText
                .replace(/^```json\s*/i, "")
                .replace(/^```\s*/, "")
                .replace(/\s*```$/, "");
        }

        let sqlQuery = ""
        try {
            const parsed = JSON.parse(translationResultText)
            sqlQuery = parsed.sql || ""
        } catch (err) {
            console.error("Failed to parse SQL JSON from Gemini response:", translationResultText);
            const parseErrorReply = "Sorry, I couldn't construct a database query for that question. Please try rephrasing.";
            
            await tenantDB.request()
                .input("sessionId", sql.VarChar, activeSessionId)
                .input("sender", sql.VarChar, "bot")
                .input("content", sql.NVarChar, parseErrorReply)
                .query("INSERT INTO tbl_chatbot_messages (session_id, sender, content) VALUES (@sessionId, @sender, @content)");

            return res.status(200).json({ success: true, reply: parseErrorReply })
        }

        let finalReply = ""

        if (!sqlQuery) {
            const generalPrompt = `You are an HRMS AI assistant.
A user asked: "${message}"

We couldn't generate an SQL query for this from our HRMS tables (employee, department, designation).
Provide a helpful, friendly response to the user. If they asked a general question, answer it. If they asked to query data we don't have, politely explain what data is available (employees, departments, designations).`;
            const reply = await callGemini(generalPrompt, apiKey);
            finalReply = reply.trim();
        } else {
            const normalizedSql = sqlQuery.trim().toUpperCase();
            const unsafeKeywords = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "EXEC", "CREATE", "RENAME"];
            const isUnsafe = unsafeKeywords.some(keyword => normalizedSql.includes(keyword)) || !normalizedSql.startsWith("SELECT");

            if (isUnsafe) {
                console.warn(`⚠️ Unsafe query blocked: ${sqlQuery}`);
                return res.status(403).json({ success: false, message: "Unsafe SQL statement generated and blocked." });
            }

            if (role === "EMPLOYEE") {
                const refersToEmployee = normalizedSql.includes("TBL_EMPLOYEE_MST");
                const refersToUserCode = sqlQuery.includes(empCode);
                
                if (refersToEmployee && !refersToUserCode) {
                    console.warn(`⚠️ Security Alert: Employee ${empCode} attempted to query tbl_employee_mst without self-filtering. Query: "${sqlQuery}"`)
                    const deniedReply = "⚠️ **Access Denied**: As an Employee, you are restricted to viewing only your own record. You cannot view other employees' data or aggregate company counts.";
                    
                    await tenantDB.request()
                        .input("sessionId", sql.VarChar, activeSessionId)
                        .input("sender", sql.VarChar, "bot")
                        .input("content", sql.NVarChar, deniedReply)
                        .query("INSERT INTO tbl_chatbot_messages (session_id, sender, content) VALUES (@sessionId, @sender, @content)")

                    return res.status(200).json({ success: true, reply: deniedReply })
                }
            }

            console.log(`Executing SQL for tenant ${req.companyCode}: ${sqlQuery}`)
            let records = []
            try {
                const result = await tenantDB.request().query(sqlQuery)
                records = result.recordset
            } catch (dbErr) {
                console.error("Database query execution error:", dbErr, "Query was:", sqlQuery)
                const dbErrorReply = `Sorry, there was an error fetching the data from the database.`
                
                await tenantDB.request()
                    .input("sessionId", sql.VarChar, activeSessionId)
                    .input("sender", sql.VarChar, "bot")
                    .input("content", sql.NVarChar, dbErrorReply)
                    .query("INSERT INTO tbl_chatbot_messages (session_id, sender, content) VALUES (@sessionId, @sender, @content)")

                return res.status(200).json({ success: true, reply: dbErrorReply })
            }

            const responsePrompt = `You are an HRMS AI assistant.
A user asked: "${message}"
We ran this SQL query: "${sqlQuery}"
And got the following results:
${JSON.stringify(records, null, 2)}

Provide a friendly, helpful response in markdown format. 
Rules:
1. If the results have multiple rows/items, use a Markdown table or list for readability.
2. Present fields using clean user-friendly labels (e.g. "Employee Name", "Designation", "Department") instead of column names (e.g. "first_name", "desig_name").
3. Do not mention internal IDs or database codes unless requested or helpful.
4. Keep the explanation concise and professional.`

            const reply = await callGemini(responsePrompt, apiKey)
            finalReply = reply.trim()
        }

        await tenantDB.request()
            .input("sessionId", sql.VarChar, activeSessionId)
            .input("sender", sql.VarChar, "bot")
            .input("content", sql.NVarChar, finalReply)
            .query("INSERT INTO tbl_chatbot_messages (session_id, sender, content) VALUES (@sessionId, @sender, @content)")

        const words = message.split(" ").slice(0, 4).join(" ")
        const newTitle = words.length > 24 ? words.substring(0, 24) + "..." : words

        await tenantDB.request()
            .input("sessionId", sql.VarChar, activeSessionId)
            .input("newTitle", sql.NVarChar, newTitle)
            .query(`
                UPDATE tbl_chatbot_sessions 
                SET title = @newTitle, updated_at = GETUTCDATE() 
                WHERE session_id = @sessionId AND title IN ('New Chat Session', 'Active Assistant Session')
            `)

        await tenantDB.request()
            .input("sessionId", sql.VarChar, activeSessionId)
            .query("UPDATE tbl_chatbot_sessions SET updated_at = GETUTCDATE() WHERE session_id = @sessionId")

        return res.status(200).json({
            success: true,
            reply: finalReply,
            sql: sqlQuery
        })

    } catch (err) {
        console.error("Error in chatbot controller:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error in chatbot assistant"
        })
    }
}

module.exports = {
    handleCreateSession,
    handleGetSessions,
    handleGetSessionMessages,
    handleDeleteSession,
    handleChatbotQuery
}
