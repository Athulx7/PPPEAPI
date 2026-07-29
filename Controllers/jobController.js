const jobRepository = require("../Repositories/JobTracking/Jobrepository")

const getFormMasters = async (req, res) => {
    try {
        const pool = req.tenantDB;
        const { job_type_id, department_code } = req.query
        const [jobTypes, statuses, priorities, departments] = await Promise.all([
            jobRepository.getJobTypes(pool),
            jobRepository.getJobStatuses(pool),
            jobRepository.getJobPriorities(pool),
            jobRepository.getDepartments(pool),
        ])

        let designations = []
        let employees = []
        if (department_code) {
            [designations, employees] = await Promise.all([
                jobRepository.getDesignations(pool, department_code),
                jobRepository.getEmployeesByDepartment(pool, department_code),
            ])
        }

        let customFields = []
        if (job_type_id) {
            customFields = await jobRepository.getCustomFieldDefinitions(pool, job_type_id)
        }

        res.status(200).json({
            success: true,
            data: { jobTypes, statuses, priorities, departments, designations, employees, customFields },
        })
    } catch (err) {
        console.error("getFormMasters error:", err)
        res.status(500).json({ success: false, message: "Failed to load form masters", error: err.message })
    }
}

const getCustomFields = async (req, res) => {
    try {
        const pool = req.tenantDB
        const { jobTypeId } = req.params

        const fields = await jobRepository.getCustomFieldDefinitions(pool, jobTypeId)
        res.status(200).json({ success: true, data: fields })
    } catch (err) {
        console.error("getCustomFields error:", err)
        res.status(500).json({ success: false, message: "Failed to load custom fields", error: err.message })
    }
}

const createJob = async (req, res) => {
    try {
        const pool = req.tenantDB
        const body = req.body

        if (!body.job_type_id || !body.title || !body.priority_id) {
            return res.status(400).json({
                success: false,
                message: "job_type_id, title, and priority_id are required",
            })
        }

        if (body.job_type_id) {
            const fieldDefs = await jobRepository.getCustomFieldDefinitions(pool, body.job_type_id)
            const requiredFields = fieldDefs.filter((f) => f.is_required)
            const providedValues = body.custom_values || []

            for (const reqField of requiredFields) {
                const match = providedValues.find((v) => v.field_id === reqField.field_id)
                if (!match || match.field_value === null || match.field_value === undefined || match.field_value === "") {
                    return res.status(400).json({
                        success: false,
                        message: `Custom field '${reqField.field_label}' is required`,
                    })
                }
            }
        }

        const createdByEmpCode = body.created_by_emp_code || req.user?.emp_code
        if (!createdByEmpCode) {
            return res.status(400).json({ success: false, message: "created_by_emp_code is required" })
        }

        const result = await jobRepository.createJob(pool, {
            ...body,
            created_by_emp_code: createdByEmpCode,
        })

        res.status(201).json({
            success: true,
            message: "Job created successfully",
            data: result,
        })
    } catch (err) {
        console.error("createJob error:", err)
        res.status(500).json({ success: false, message: "Failed to create job", error: err.message })
    }
}

const createSubJob = async (req, res) => {
    try {
        const { parentJobId } = req.params
        const pool = req.tenantDB
        const body = req.body

        if (!body.job_type_id || !body.title || !body.priority_id) {
            return res.status(400).json({
                success: false,
                message: "job_type_id, title, and priority_id are required",
            })
        }

        const parentJob = await jobRepository.getJobById(pool, parentJobId)
        if (!parentJob) {
            return res.status(404).json({ success: false, message: "Parent job not found" })
        }

        const createdByEmpCode = body.created_by_emp_code || req.user?.emp_code

        const result = await jobRepository.createJob(pool, {
            ...body,
            parent_job_id: parentJobId,
            created_by_emp_code: createdByEmpCode,
        })

        res.status(201).json({
            success: true,
            message: "Sub-job created successfully",
            data: result,
        })
    } catch (err) {
        console.error("createSubJob error:", err)
        res.status(500).json({ success: false, message: "Failed to create sub-job", error: err.message })
    }
}

const listJobs = async (req, res) => {
    try {
        const pool = req.tenantDB
        const filters = {
            status_id: req.query.status_id,
            priority_id: req.query.priority_id,
            job_type_id: req.query.job_type_id,
            assigned_to_emp_code: req.query.assigned_to_emp_code,
            assigned_department_code: req.query.assigned_department_code,
            parent_job_id: req.query.parent_job_id,
            search: req.query.search,
            page: parseInt(req.query.page) || 1,
            pageSize: parseInt(req.query.pageSize) || 20,
            sortBy: req.query.sortBy,
            sortOrder: req.query.sortOrder,
            user_scope_emp_code: req.query.user_scope_emp_code,
        }

        const result = await jobRepository.getJobList(pool, filters)
        res.status(200).json({ success: true, ...result })
    } catch (err) {
        console.error("listJobs error:", err)
        res.status(500).json({ success: false, message: "Failed to fetch jobs", error: err.message })
    }
}

const getJob = async (req, res) => {
    try {
        const pool = req.tenantDB
        const { jobId } = req.params

        const job = await jobRepository.getJobById(pool, jobId)
        if (!job) {
            return res.status(404).json({ success: false, message: "Job not found" })
        }

        const [customValues, timeSummary, assignmentHistory, statusHistory] = await Promise.all([
            jobRepository.getCustomFieldValuesByJob(pool, jobId),
            jobRepository.getJobTimeSummary(pool, jobId),
            jobRepository.getAssignmentHistory(pool, jobId),
            jobRepository.getStatusHistory(pool, jobId),
        ]);

        res.status(200).json({
            success: true,
            data: {
                ...job,
                custom_fields: customValues,
                time_summary: timeSummary,
                assignment_history: assignmentHistory,
                status_history: statusHistory,
            },
        });
    } catch (err) {
        console.error("getJob error:", err);
        res.status(500).json({ success: false, message: "Failed to fetch job", error: err.message })
    }
}

const runJob = async (req, res) => {
    try {
        const pool = req.tenantDB
        const { jobId } = req.params
        const empCode = req.body.emp_code || req.user?.emp_code

        if (!empCode) {
            return res.status(400).json({ success: false, message: "emp_code is required" })
        }

        const result = await jobRepository.startTimer(pool, jobId, empCode, req.body.running_status_id)
        res.status(200).json({ success: true, message: "Timer started", data: result })
    } catch (err) {
        console.error("runJob error:", err)
        res.status(500).json({ success: false, message: "Failed to start timer", error: err.message })
    }
}

const stopJob = async (req, res) => {
    try {
        const pool = req.tenantDB;
        const { jobId } = req.params;
        const empCode = req.body.emp_code || req.user?.emp_code;

        if (!empCode) {
            return res.status(400).json({ success: false, message: "emp_code is required" });
        }

        const result = await jobRepository.stopTimer(pool, jobId, { ...req.body, emp_code: empCode });
        res.status(200).json({ success: true, message: "Timer stopped", data: result });
    } catch (err) {
        console.error("stopJob error:", err);
        res.status(500).json({ success: false, message: "Failed to stop timer", error: err.message });
    }
};

const assignJob = async (req, res) => {
    try {
        const pool = req.tenantDB;
        const { jobId } = req.params;
        const actionByEmpCode = req.body.action_by_emp_code || req.user?.emp_code;

        if (!actionByEmpCode) {
            return res.status(400).json({ success: false, message: "action_by_emp_code is required" });
        }
        if (!req.body.to_emp_code && !req.body.to_department_code) {
            return res.status(400).json({ success: false, message: "Provide to_emp_code or to_department_code" });
        }

        const result = await jobRepository.assignOrReferJob(pool, jobId, {
            ...req.body,
            action_by_emp_code: actionByEmpCode,
        });
        res.status(200).json({ success: true, message: "Job reassigned", data: result });
    } catch (err) {
        console.error("assignJob error:", err);
        res.status(500).json({ success: false, message: "Failed to assign job", error: err.message });
    }
};

module.exports = {
    getFormMastersController: getFormMasters,
    getCustomFieldsController: getCustomFields,
    createJobController: createJob,
    createSubJobController: createSubJob,
    listJobsController: listJobs,
    getJobController: getJob,
    runJobController: runJob,
    stopJobController: stopJob,
    assignJobController: assignJob,
};