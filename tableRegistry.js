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

    

};

module.exports = TABLE_REGISTRY