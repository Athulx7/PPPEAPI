const express = require('express');
const router = express.Router();

router.post('/api/login', require('../Controllers/login/authController').login)
module.exports = router;