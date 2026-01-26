const jwt = require("jsonwebtoken")
const SECRET = process.env.JWT_SECRET

function generateJWT(data) {
    return jwt.sign(data, SECRET, { expiresIn: "8h" })
}

function validateJWT(token) {
    return jwt.verify(token, SECRET)
}

function extractToken(req) {
    const token = req.headers["authorization"]?.split(" ")[1]
    if (!token) throw new Error("Token missing")
    return token
}

module.exports = { generateJWT, validateJWT, extractToken }