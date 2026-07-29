require("dotenv").config({ path: "../.env" })
const https = require("https")

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
    console.error("GEMINI_API_KEY is not env")
    process.exit(1)
}

function listModels() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: "generativelanguage.googleapis.com",
            port: 443,
            path: `/v1beta/models?key=${apiKey}`,
            method: "GET"
        }

        const req = https.request(options, (res) => {
            let body = ""
            res.on("data", (chunk) => {
                body += chunk
            })
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(body)
                    resolve(parsed)
                } catch (e) {
                    reject(new Error("Failed to parse response: " + e.message))
                }
            })
        })

        req.on("error", reject)
        req.end()
    })
}

listModels().then((data) => {
    console.log("=== Available Models ===")
    if (data.models) {
        data.models.forEach((m) => {
            console.log(`- ${m.name} (Methods: ${m.supportedGenerationMethods.join(", ")})`)
        })
    } else {
        console.log("No models field found in response:", JSON.stringify(data, null, 2))
    }
}).catch((err) => console.error("Error:", err))
