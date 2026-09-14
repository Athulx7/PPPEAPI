// ai/tableRegistry.js

const TABLE_REGISTRY = {
    employee: {
        table: "tbl_employee_mst",
        description: "Stores employee master details.",
        primaryKey: "emp_code",
        searchableColumns: [
            "id",
            "emp_code",
            "first_name",
            "last_name",
            "email",
            "department_code",
            "designation_code",
            "joining_date",
            "currency_code",
            "hierarchy_code",
            "reporting_manager_code",
            "address_line1",
            "address_line2",
            "city",
            "state",
            "country",
            "postal_code",
            "pan_number",
            "mobile_number",
            "date_of_birth",
            "gender",
            "employee_type_code",
            "probation_months",
            "probation_end_date",
            "bank_account_number",
            "bank_name",
            "ifsc_code",
            "branch_name",
            "is_active",
            "created_at",
            "updated_at",
            "role_code"
        ],

        columns: [
            "id",
            "emp_code",
            "first_name",
            "last_name",
            "email",
            "department_code",
            "designation_code",
            "joining_date",
            "currency_code",
            "hierarchy_code",
            "reporting_manager_code",
            "address_line1",
            "address_line2",
            "city",
            "state",
            "country",
            "postal_code",
            "pan_number",
            "mobile_number",
            "date_of_birth",
            "gender",
            "employee_type_code",
            "probation_months",
            "probation_end_date",
            "bank_account_number",
            "bank_name",
            "ifsc_code",
            "branch_name",
            "is_active",
            "created_at",
            "updated_at",
            "role_code"
        ],
    },

    department: {
        table: "tbl_department_mst",
        description: "Department master",
        primaryKey: "depart_code",
        searchableColumns: [
            "depart_name",
            "depart_description",
            "is_active",
            "created_at"
        ],
        columns: [
           "id", "depart_code", "depart_name", "depart_description", "is_active", "created_at"
        ]
    },

    designation: {
        table: "tbl_designation_mst",
        description: "Designation Master",
        primaryKey: "desig_code",
        searchableColumns: [
            "desig_name",
            "desig_description",
            "depart_code",
            "is_active",
            "created_at"
        ],

        columns: [
            "id", "desig_code", "desig_name", "desig_description", "depart_code", "is_active", "created_at",
        ]
    },

    payrollsettings_general: {
        table: "tbl_payrollsettings_general",
        description: "General Payroll Settings",
        primaryKey: "id",
        searchableColumns: ["payroll_frequency", "calculation_basis", "processing_day", "enable_auto_payroll"],
        columns: ["id", "payroll_frequency", "calculation_basis", "processing_day", "enable_auto_payroll", "is_active", "created_at", "updated_at", "enable_regularization"]
    },

    payroll_run: {
        table: "tbl_payroll_run",
        description: "Payroll Runs Summary",
        primaryKey: "id",
        searchableColumns: ["payroll_run_code", "period_month", "period_year", "status", "run_type"],
        columns: ["id", "payroll_run_code", "period_month", "period_year", "start_date", "end_date", "total_employees", "total_gross_pay", "total_deductions", "total_net_pay", "status", "run_type", "processed_by", "created_at", "updated_at"]
    },

    payslip: {
        table: "tbl_payslip",
        description: "Employee Generated Payslips",
        primaryKey: "id",
        searchableColumns: ["payslip_code", "emp_code", "period_month", "period_year", "status"],
        columns: ["id", "payroll_run_id", "payslip_code", "emp_code", "period_month", "period_year", "working_days", "present_days", "paid_leaves", "unpaid_leaves_lop", "basic_salary", "gross_earnings", "salary_advance_deduction", "statutory_deductions", "other_deductions", "total_deductions", "net_pay", "earnings_breakdown", "deductions_breakdown", "status", "created_at"]
    }
};

module.exports = TABLE_REGISTRY