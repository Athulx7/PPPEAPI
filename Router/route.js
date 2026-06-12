const express = require('express');
const router = express.Router();

const tenantResolver = require('../Middleware/tennetMiddleware').tenantResolver;
const { getUploadMastersController, downloadTemplateController, uploadFileController, getBatchStatusController, getBatchErrorsController,
    getUploadHistoryController, getUploadTypesController, uploadMiddleware, getBatchRecordsController
} = require('../Controllers/uploadData/dataUploadController')

router.post('/api/login', require('../Controllers/login/authController').login)

router.get('/api/side-menu', tenantResolver, require('../Controllers/menuitems/menuItemsController').MenuitemsController)
router.get('/api/mainMenu', tenantResolver, require('../Controllers/menuitems/menuItemsController').getMainMenuDataController)
router.get('/api/searchMenu', tenantResolver, require('../Controllers/menuitems/menuItemsController').getSearchMenuController)
router.get('/api/systemRoles', tenantResolver, require('../Controllers/menuitems/menuItemsController').getSystemRolesController)
router.get('/api/menuFavourites', tenantResolver, require('../Controllers/menuitems/menuItemsController').getFavouritesController)
router.post('/api/menuFavourites/toggle', tenantResolver, require('../Controllers/menuitems/menuItemsController').savetoggleFavourite)

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
router.get('/api/getcompanyinfo', tenantResolver, require('../Controllers/companysettingsCotroller').getcompanyinfoCOntrller)
//end

//employee mst
router.get('/api/empmst/getcontrols', tenantResolver, require('../Controllers/employeeMasterController').getEMpMasterCntrlsController)
router.get('/api/empmst/getempmstdropdowndata/:column', tenantResolver, require('../Controllers/employeeMasterController').getEmpMstDropdwonDataController)
router.post('/api/empmst/saveempmaster', tenantResolver, require('../Controllers/employeeMasterController').saveEmpmasterController)
router.get('/api/empmst/departmentsList', tenantResolver, require('../Controllers/employeeMasterController').getDepartmentForEMpListController)
router.get('/api/empmst/designantionList', tenantResolver, require('../Controllers/employeeMasterController').getDesignationForEMpListController)
router.get('/api/empmst/hierarchyLevel', tenantResolver, require('../Controllers/employeeMasterController').gethierarchyLevelForEMpListController)
router.get('/api/empmst/employeeList', tenantResolver, require('../Controllers/employeeMasterController').getEmployeeListController)
router.get("/api/empmst/getemployee/:id", tenantResolver, require('../Controllers/employeeMasterController').getEmployeeByIDController)
router.put("/api/empmst/updateempmaster/:id", tenantResolver, require('../Controllers/employeeMasterController').UpdateEMpMstController)
//end

//salry component
router.post('/api/salarycomponent/save', tenantResolver, require('../Controllers/salaryComponentsController').saveSalaryComponentsController)
router.put('/api/salarycomponent/update', tenantResolver, require('../Controllers/salaryComponentsController').updateSalaryComponentController)
router.get('/api/salarycomponent/list', tenantResolver, require('../Controllers/salaryComponentsController').getSalaryComponentsController)
router.delete('/api/salarycomponent/delete/:id', tenantResolver, require('../Controllers/salaryComponentsController').deleteSalaryComponentController)
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
router.put('/api/salarystructure/assignment/:id', tenantResolver, require('../Controllers/salaryAssignmentController').updateSalaryAssignmentController)
//end

//upload data
router.get('/api/upload/masters', tenantResolver, getUploadMastersController)
router.get('/api/upload/template/:uploadCode', tenantResolver, downloadTemplateController)
router.post('/api/upload/file', tenantResolver, uploadMiddleware, uploadFileController)
router.get('/api/upload/batch/:batchId', tenantResolver, getBatchStatusController)
router.get('/api/upload/batch/:batchId/errors', tenantResolver, getBatchErrorsController)
router.get('/api/upload/batch/:batchId/records', tenantResolver, getBatchRecordsController)
router.get('/api/upload/history', tenantResolver, getUploadHistoryController)
router.get('/api/upload/history/types', tenantResolver, getUploadTypesController)
//end

//module mapping
router.get('/api/menumapping/systemroles', tenantResolver, require('../Controllers/menuMappingController').getMenuMappingSystemrolesController)
router.get('/api/menumapping/department', tenantResolver, require('../Controllers/menuMappingController').getMenuMappingDepartmentController)
router.get('/api/menumapping/designation', tenantResolver, require('../Controllers/menuMappingController').getMenuMappingDesignationController)
router.get('/api/menumapping/employees', tenantResolver, require('../Controllers/menuMappingController').getMenuMappingEmployeesController)
router.get('/api/menumapping/allSubMenus', tenantResolver, require('../Controllers/menuMappingController').getMenuMappingAllMenusController)
router.get('/api/menumapping/load', tenantResolver, require('../Controllers/menuMappingController').getMenuMappingLoadMenu)
router.post('/api/menumapping/save', tenantResolver, require('../Controllers/menuMappingController').SaveMenuMappingController)
//end

//chat
router.get('/api/chat/employees', tenantResolver, require('../Controllers/chatController').getFullemplopyeeDataController)
router.post('/api/chat/rooms/dm', tenantResolver, require('../Controllers/chatController').createChatDmController)
router.get('/api/chat/rooms', tenantResolver, require('../Controllers/chatController').getChatRoomsController)
router.get('/api/chat/rooms/:roomId/messages', tenantResolver, require('../Controllers/chatController').getChatMessagesController)

//Leave Master
router.get('/api/leavemaster/categoryList', tenantResolver, require('../Controllers/leaveMasterController').getLeaveMasterCategoryController)
router.get('/api/leavemaster/categoryData/:categorycode', tenantResolver, require('../Controllers/leaveMasterController').getLeaveCategoryDataBasedSelectionController)
router.get('/api/leavemaster/fieldConfig', tenantResolver, require('../Controllers/leaveMasterController').getLeaveconfigController)
router.get('/api/leavemaster/accrualTypeList', tenantResolver, require('../Controllers/leaveMasterController').getLeaveMasterAccuralTypeController)
router.post('/api/leavemaster/saveLeaveType', tenantResolver, require('../Controllers/leaveMasterController').saveLeaveTypeController)
router.get('/api/leavemaster/savedLeaveTypeList', tenantResolver, require('../Controllers/leaveMasterController').getSavedLeaveTypeDataController)
router.get('/api/leavemaster/leaveType/:id', tenantResolver, require('../Controllers/leaveMasterController').getLeaveTypeDataWithIDController)
router.put('/api/leavemaster/updateLeaveType/:id', tenantResolver, require('../Controllers/leaveMasterController').updateLeaveTypeController)
router.delete('/api/leavemaster/deleteLeaveType/:id', tenantResolver, require('../Controllers/leaveMasterController').deleteLeaveTypeByIdController)

//Leave Settings
router.get('/api/leavesettings/department', tenantResolver, require('../Controllers/leaveSettingsController').getLeaveSettingsDepartmentController)
router.get('/api/leavesettings/designation', tenantResolver, require('../Controllers/leaveSettingsController').getLeaveSettingsDesignationController)
router.get('/api/leavesettings/hierarchy', tenantResolver, require('../Controllers/leaveSettingsController').getLeaveSettingsHierarchyController)
router.get('/api/leavesettings/employeetype', tenantResolver, require('../Controllers/leaveSettingsController').getLeaveSettingsEmployeeTypeController)
router.get('/api/leavesettings/employees', tenantResolver, require('../Controllers/leaveSettingsController').getLeaveSettingsEMployeesListController)
router.get('/api/leavesettings/leaveTypes', tenantResolver, require('../Controllers/leaveSettingsController').getLeaveTypesForSettingsController)
router.get('/api/leavesettings/allocations', tenantResolver, require('../Controllers/leaveSettingsController').getLeaveAllocationsController)
router.get('/api/leavesettings/allocation/:id', tenantResolver, require('../Controllers/leaveSettingsController').getLeaveAllocationByIdController)
router.post('/api/leavesettings/allocation', tenantResolver, require('../Controllers/leaveSettingsController').saveSingleAllocationController)
router.post('/api/leavesettings/allocation/bulk', tenantResolver, require('../Controllers/leaveSettingsController').saveBulkAllocationController)
router.put('/api/leavesettings/allocation/:id', tenantResolver, require('../Controllers/leaveSettingsController').updateLeaveAllocationController)
router.delete('/api/leavesettings/allocation/:id', tenantResolver, require('../Controllers/leaveSettingsController').deleteLeaveAllocationController)
router.get('/api/leavesettings/employees/all', tenantResolver, require('../Controllers/leaveSettingsController').GetAllEmplForLeavesettings)
router.get('/api/leavesettings/designations/all', tenantResolver, require('../Controllers/leaveSettingsController').GetAllDesignationForLeavesettings)






module.exports = router;