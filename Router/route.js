const express = require('express');
const router = express.Router();

const tenantResolver = require('../Middleware/tennetMiddleware').tenantResolver;

router.post('/api/login', require('../Controllers/login/authController').login)

router.get('/api/side-menu', tenantResolver, require('../Controllers/menuitems/menuItemsController').MenuitemsController)
router.get('/api/mainMenu', tenantResolver, require('../Controllers/menuitems/menuItemsController').getMainMenuDataController)
router.get('/api/searchMenu', tenantResolver, require('../Controllers/menuitems/menuItemsController').getSearchMenuController)
router.get('/api/systemRoles', tenantResolver, require('../Controllers/menuitems/menuItemsController').getSystemRolesController)

router.get('/api/getmenubasedcontrols/:menuid', tenantResolver, require('../Controllers/master/masterController').getMenuBasedControlsController)
// master datas 
router.get('/api/master/:mastercode/getlist', tenantResolver, require('../Controllers/master/masterController').getMasterTableLIistController)
router.get('/api/master/:mastercode/getcontents', tenantResolver, require('../Controllers/master/masterController').getMasterContentController)
router.get("/api/master/:mastercode/:id", tenantResolver, require("../Controllers/master/masterController").getMasterDataByIDController);
router.get('/api/master/:mastercode/dropdown/:column', tenantResolver, require('../Controllers/master/masterController').getDropdonwDataController)
router.post('/api/master/:mastercode/save', tenantResolver, require('../Controllers/master/masterController').saveMasterController)
//end

//comapay settings
router.post('/api/savecomapnyinfo', tenantResolver, require('../Controllers/companysettingsCotroller').saveUpdaetCOmpanySettingsController)
router.get('/api/getcompanyinfo',tenantResolver, require('../Controllers/companysettingsCotroller').getcompanyinfoCOntrller)
//end

//employee mst
router.get('/api/empmst/getcontrols', tenantResolver, require('../Controllers/employeeMasterController').getEMpMasterCntrlsController)
router.get('/api/empmst/getempmstdropdowndata/:column', tenantResolver, require('../Controllers/employeeMasterController').getEmpMstDropdwonDataController)
router.post('/api/empmst/saveempmaster',tenantResolver, require('../Controllers/employeeMasterController').saveEmpmasterController)
router.get('/api/empmst/departmentsList', tenantResolver, require('../Controllers/employeeMasterController').getDepartmentForEMpListController)
router.get('/api/empmst/designantionList', tenantResolver, require('../Controllers/employeeMasterController').getDesignationForEMpListController)
router.get('/api/empmst/hierarchyLevel', tenantResolver,  require('../Controllers/employeeMasterController').gethierarchyLevelForEMpListController)
router.get('/api/empmst/employeeList', tenantResolver, require('../Controllers/employeeMasterController').getEmployeeListController)
router.get("/api/empmst/getemployee/:id", tenantResolver, require('../Controllers/employeeMasterController').getEmployeeByIDController)
router.put("/api/empmst/updateempmaster/:id", tenantResolver, require('../Controllers/employeeMasterController').UpdateEMpMstController)
//end

//SALARY STRUCTURE
router.get('/api/salarystructure/dropdownCcomponent', tenantResolver, require('../Controllers/salaryStructureController').getComponentDropDataController)
router.get('/api/salarystructure/dropdownCalculationtype', tenantResolver, require('../Controllers/salaryStructureController').getComponentCalculationTypeDropDataController)
router.get('/api/salarystructure/dropdownComponentType', tenantResolver, require('../Controllers/salaryStructureController').getDropdownComponentTypeController)

router.post('/api/salarystructure/save', tenantResolver, require('../Controllers/salaryStructureController').createSalaryStructueController)
router.get('/api/salarystructure/list', tenantResolver, require('../Controllers/salaryStructureController').getSavedStructuresListController)

router.get('/api/salarystructure/assignmentDropdowns', tenantResolver, require('../Controllers/salaryAssignmentController').getAssignmentDropdownsController)
router.get('/api/salarystructure/getassignments', tenantResolver, require('../Controllers/salaryAssignmentController').getAllAssignmentsController)
router.post('/api/salarystructure/saveassign', tenantResolver, require('../Controllers/salaryAssignmentController').createAssignmentController)

router.put('/api/salarystructure/:id', tenantResolver, require('../Controllers/salaryStructureController').updateSalaryStructureController)
router.get('/api/salarystructure/:id', tenantResolver, require('../Controllers/salaryStructureController').getSalaryStructureByIdController)
router.get('/api/salarystructure/assignment/:id', tenantResolver, require('../Controllers/salaryAssignmentController').getAssignmentByIdController)
router.put('/api/salarystructure/assignment/:id',tenantResolver, require('../Controllers/salaryAssignmentController').updateSalaryAssignmentController)
//end

//chat
router.get('/api/chat/employees', tenantResolver, require('../Controllers/chatController').getFullemplopyeeDataController)
router.post('/api/chat/rooms/dm', tenantResolver, require('../Controllers/chatController').createChatDmController)
router.get('/api/chat/rooms', tenantResolver, require('../Controllers/chatController').getChatRoomsController)
router.get('/api/chat/rooms/:roomId/messages', tenantResolver, require('../Controllers/chatController').getChatMessagesController)





module.exports = router;