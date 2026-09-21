const express = require('express');
const router = express.Router();

const tenantResolver = require('../Middleware/tennetMiddleware').tenantResolver;
const { getUploadMastersController, downloadTemplateController, uploadFileController, getBatchStatusController, getBatchErrorsController,
    getUploadHistoryController, getUploadTypesController, uploadMiddleware, getBatchRecordsController
} = require('../Controllers/uploadData/dataUploadController')

router.post('/api/login', require('../Controllers/login/authController').login)
router.post('/api/auth/refresh-token', tenantResolver, require('../Controllers/login/authController').refreshTokenController)

// Dashboard Data APIs
router.get('/api/dashboard/admin', tenantResolver, require('../Controllers/dashboardController').getAdminDashboardController)
router.get('/api/dashboard/hr', tenantResolver, require('../Controllers/dashboardController').getHrDashboardController)
router.get('/api/dashboard/payroll', tenantResolver, require('../Controllers/dashboardController').getPayrollDashboardController)
router.get('/api/dashboard/employee', tenantResolver, require('../Controllers/dashboardController').getEmployeeDashboardController)

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
router.post('/api/chatbot/query', tenantResolver, require('../Controllers/chatbotController').handleChatbotQuery)
router.post('/api/chatbot/sessions/new', tenantResolver, require('../Controllers/chatbotController').handleCreateSession)
router.get('/api/chatbot/sessions', tenantResolver, require('../Controllers/chatbotController').handleGetSessions)
router.get('/api/chatbot/sessions/:sessionId/messages', tenantResolver, require('../Controllers/chatbotController').handleGetSessionMessages)
router.delete('/api/chatbot/sessions/:sessionId', tenantResolver, require('../Controllers/chatbotController').handleDeleteSession)



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
router.get('/api/leavemaster/leaveapprovers', tenantResolver, require('../Controllers/leaveMasterController').getLeaveApproversLeaveMstController)

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


// JOB TRACKING - CALENDAR
router.get("/api/jobs/calendar", tenantResolver, require('../Controllers/jobCalendarController').getCalendarBlocks)
router.get("/api/jobs/calendar/month", tenantResolver, require('../Controllers/jobCalendarController').getMonthActivity)
router.get("/api/jobs/calendar/summary", tenantResolver, require('../Controllers/jobCalendarController').getMonthSummary)


// JOB TRACKING
router.get('/api/jobs/masters', tenantResolver, require('../Controllers/jobController').getFormMastersController)
router.get('/api/jobs/custom-fields/:jobTypeId', tenantResolver, require('../Controllers/jobController').getCustomFieldsController)
router.get('/api/jobs', tenantResolver, require('../Controllers/jobController').listJobsController)
router.get('/api/jobs/:jobId', tenantResolver, require('../Controllers/jobController').getJobController)
router.post('/api/jobs', tenantResolver, require('../Controllers/jobController').createJobController)
router.post('/api/jobs/:parentJobId/sub-job', tenantResolver, require('../Controllers/jobController').createSubJobController)
router.post('/api/jobs/:jobId/run', tenantResolver, require('../Controllers/jobController').runJobController)
router.post('/api/jobs/:jobId/stop', tenantResolver, require('../Controllers/jobController').stopJobController)
router.post('/api/jobs/:jobId/assign', tenantResolver, require('../Controllers/jobController').assignJobController)

router.post('/api/excmd/execute', tenantResolver, require('../Controllers/excmdController').executeQuery)


// USER PROFILE
router.get('/api/userprofile/getprofile', tenantResolver, require('../Controllers/userProfileController').getUserProfileController)
router.put('/api/userprofile/updateprofile', tenantResolver, require('../Controllers/userProfileController').updateUserProfileController)
router.post('/api/userprofile/changepassword', tenantResolver, require('../Controllers/userProfileController').changePasswordController)


//Payroll Settings
router.get('/api/payrollsettings/modules', tenantResolver, require('../Controllers/payRollsettingsController').getPayrollSettingsModulesController)
router.get('/api/payrollsettings/fields/:moduleKey', tenantResolver, require('../Controllers/payRollsettingsController').getModuleFieldsController)
router.post('/api/payrollsettings/save-module', tenantResolver, require('../Controllers/payRollsettingsController').saveModuleSettingsController)
router.get('/api/payrollsettings/work-schedules', tenantResolver, require('../Controllers/payRollsettingsController').getWorkSchedulesController)
router.post('/api/payrollsettings/work-schedules', tenantResolver, require('../Controllers/payRollsettingsController').saveWorkScheduleController)
router.put('/api/payrollsettings/work-schedules/:id', tenantResolver, require('../Controllers/payRollsettingsController').updateWorkScheduleController)
router.delete('/api/payrollsettings/work-schedules/:id', tenantResolver, require('../Controllers/payRollsettingsController').deleteWorkScheduleController)
// Statutory Routes
router.get('/api/payrollsettings/statutory/states', tenantResolver, require('../Controllers/payRollsettingsController').getStatesForStatutoryController)
router.post('/api/payrollsettings/statutory/pt-slabs', tenantResolver, require('../Controllers/payRollsettingsController').savePtSlabController)
router.put('/api/payrollsettings/statutory/pt-slabs/:id', tenantResolver, require('../Controllers/payRollsettingsController').updatePtSlabController)
router.delete('/api/payrollsettings/statutory/pt-slabs/:id', tenantResolver, require('../Controllers/payRollsettingsController').deletePtSlabController)
router.post('/api/payrollsettings/statutory/lwf', tenantResolver, require('../Controllers/payRollsettingsController').saveLwfController)
router.put('/api/payrollsettings/statutory/lwf/:id', tenantResolver, require('../Controllers/payRollsettingsController').updateLwfController)
router.delete('/api/payrollsettings/statutory/lwf/:id', tenantResolver, require('../Controllers/payRollsettingsController').deleteLwfController)
router.post('/api/payrollsettings/statutory/esi', tenantResolver, require('../Controllers/payRollsettingsController').saveEsiController)

//MyLeaves
router.get('/api/myleaves/getAllMyLeaves', tenantResolver, require('../Controllers/LeaveMyLeavesController').getAllMyLeavesDataController)
router.get('/api/myleaves/getLeaveHistory', tenantResolver, require('../Controllers/LeaveMyLeavesController').getLeaveHistoryController)
router.get('/api/myleaves/getLeaveAnalytics', tenantResolver, require('../Controllers/LeaveMyLeavesController').getLeaveAnalyticsController)

//LeaveRequest
router.get('/api/leaverequest/userWorkSchedule', tenantResolver, require('../Controllers/LeaveRequestController').getUserWorkScheduleController)
router.get('/api/leaverequest/holidays', tenantResolver, require('../Controllers/LeaveRequestController').getHolidayOfEmployeeBranchWIseController)
router.get('/api/leaverequest/myRequests', tenantResolver, require('../Controllers/LeaveRequestController').getMyLeaveRequestsController)
router.post('/api/leaverequest/apply', tenantResolver, require('../Controllers/LeaveRequestController').applyLeaveRequestController)
router.post('/api/leaverequest/cancel', tenantResolver, require('../Controllers/LeaveRequestController').cancelLeaveRequestController)

//LeaveApproval
router.get('/api/leaveapproval/getDownlineRequests', tenantResolver, require('../Controllers/LeaveApprovalController').getDownlineLeaveRequestsController)
router.post('/api/leaveapproval/approve', tenantResolver, require('../Controllers/LeaveApprovalController').approveLeaveRequestController)
router.post('/api/leaveapproval/reject', tenantResolver, require('../Controllers/LeaveApprovalController').rejectLeaveRequestController)

//Attendance
router.get('/api/attendance/myAttendance', tenantResolver, require('../Controllers/AttendanceController').getMyAttendanceController)
router.get('/api/attendance/myRegularizations', tenantResolver, require('../Controllers/AttendanceController').getMyRegularizationsController)
router.post('/api/attendance/applyRegularization', tenantResolver, require('../Controllers/AttendanceController').applyRegularizationController)
router.post('/api/attendance/transferCurrentMonth', tenantResolver, require('../Controllers/AttendanceController').transferCurrentMonthAttendanceController)

//Salary Advance
router.get('/api/salaryadvance/info', tenantResolver, require('../Controllers/salaryAdvanceController').getSalaryAdvanceInfoController)
router.get('/api/salaryadvance/my-requests', tenantResolver, require('../Controllers/salaryAdvanceController').getMySalaryAdvanceRequestsController)
router.post('/api/salaryadvance/request', tenantResolver, require('../Controllers/salaryAdvanceController').createSalaryAdvanceRequestController)
router.post('/api/salaryadvance/cancel', tenantResolver, require('../Controllers/salaryAdvanceController').cancelSalaryAdvanceRequestController)
router.get('/api/salaryadvance/approval-list', tenantResolver, require('../Controllers/salaryAdvanceController').getDownlineSalaryAdvanceRequestsController)
router.post('/api/salaryadvance/approve', tenantResolver, require('../Controllers/salaryAdvanceController').approveSalaryAdvanceRequestController)
router.post('/api/salaryadvance/reject', tenantResolver, require('../Controllers/salaryAdvanceController').rejectSalaryAdvanceRequestController)
router.post('/api/salaryadvance/disburse', tenantResolver, require('../Controllers/salaryAdvanceController').disburseSalaryAdvanceRequestController)

//Payroll Generator & Payslips
router.get('/api/payroll/auto-run-config', tenantResolver, require('../Controllers/payrollController').getAutoRunConfigController)
router.get('/api/payroll/preflight-checks', tenantResolver, require('../Controllers/payrollController').getPreflightChecksController)
router.post('/api/payroll/run', tenantResolver, require('../Controllers/payrollController').runPayrollController)
router.get('/api/payroll/runs', tenantResolver, require('../Controllers/payrollController').getPayrollRunsController)
router.get('/api/payroll/run/:runId', tenantResolver, require('../Controllers/payrollController').getPayrollRunDetailsController)
router.get('/api/payroll/payslip/:payslipId', tenantResolver, require('../Controllers/payrollController').getPayslipDetailsController)
router.get('/api/payroll/payslips', tenantResolver, require('../Controllers/payrollController').getPayslipsController)
router.get('/api/payroll/ctc-report', tenantResolver, require('../Controllers/payrollController').getCtcReportController)

// Payroll Preflight Deep-Dive Inspection Endpoints
router.get('/api/payroll/inspect/attendance-lop', tenantResolver, require('../Controllers/payrollController').getLopAttendanceInspectionController)
router.get('/api/payroll/inspect/overtime', tenantResolver, require('../Controllers/payrollController').getOvertimeInspectionController)
router.get('/api/payroll/inspect/advances', tenantResolver, require('../Controllers/payrollController').getAdvanceInspectionController)

// ==========================================
// SYSTEM ADMIN (SUPER ADMIN) ROUTES
// ==========================================
const { systemAuthMiddleware } = require('../Middleware/systemAuthMiddleware');
const systemAdminCtrl = require('../Controllers/systemAdminController');

router.post('/api/system/login', systemAdminCtrl.loginController);
router.get('/api/system/metrics', systemAuthMiddleware, systemAdminCtrl.getMetricsController);
router.get('/api/system/clients', systemAuthMiddleware, systemAdminCtrl.getClientsController);
router.get('/api/system/template-config', systemAuthMiddleware, systemAdminCtrl.getTemplateConfigController);
router.post('/api/system/clients', systemAuthMiddleware, systemAdminCtrl.createClientController);
router.put('/api/system/clients/:company_code/renew', systemAuthMiddleware, systemAdminCtrl.renewClientController);
router.put('/api/system/clients/:company_code/status', systemAuthMiddleware, systemAdminCtrl.updateStatusController);
router.post('/api/system/template/backup', systemAuthMiddleware, systemAdminCtrl.triggerBackupTemplateController);

module.exports = router;