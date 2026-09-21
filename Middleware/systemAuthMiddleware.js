const { validateJWT, extractToken } = require('./jwtMiddleware');

function systemAuthMiddleware(req, res, next) {
    try {
        const token = extractToken(req);
        const decoded = validateJWT(token);

        if (!decoded || decoded.role_code !== 'SYSTEM_ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Access Denied: System Administrator privileges required.'
            });
        }

        req.systemAdmin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired session token.',
            error: err.message
        });
    }
}

module.exports = { systemAuthMiddleware };
