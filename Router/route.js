const express = require('express');
const router = express.Router();

const tenantResolver = require('../Middleware/tennetMiddleware').tenantResolver;

router.post('/api/login', require('../Controllers/login/authController').login)

router.get('/api/side-menu', tenantResolver, require('../Controllers/menuitems/menuItemsController').MenuitemsController)
router.get('/api/mainMenu', tenantResolver, require('../Controllers/menuitems/menuItemsController').getMainMenuDataController)
router.get('/api/searchMenu', tenantResolver, require('../Controllers/menuitems/menuItemsController').getSearchMenuController)
router.get('/api/systemRoles', tenantResolver, require('../Controllers/menuitems/menuItemsController').getSystemRolesController)

// master datas 
router.get('/api/master/:menuid/getlist', tenantResolver, require('../Controllers/master/masterController').getMasterTableLIistController)
router.get('/api/master/:menuid/getcontents', tenantResolver, require('../Controllers/master/masterController').getMasterContentController)
router.get("/api/master/:menuid/:id", tenantResolver, require("../Controllers/master/masterController").getMasterDataByIDController);
router.get('/api/master/:menuid/dropdown/:column', tenantResolver, require('../Controllers/master/masterController').getDropdonwDataController)
router.post('/api/master/:menuid/save', tenantResolver, require('../Controllers/master/masterController').saveMasterController)

module.exports = router;