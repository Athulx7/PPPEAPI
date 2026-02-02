const express = require('express');
const router = express.Router();

const tenantResolver = require('../Middleware/tennetMiddleware').tenantResolver;

router.post('/api/login', require('../Controllers/login/authController').login)

router.get('/api/side-menu', tenantResolver, require('../Controllers/menuitems/menuItemsController').MenuitemsController)
router.get('/api/systemRoles', tenantResolver, require('../Controllers/menuitems/menuItemsController').getSystemRolesController)

// master datas 
router.get('/api/master/:menuid/getlist', tenantResolver, require('../Controllers/master/masterController').getMasterTableLIistController)

module.exports = router;