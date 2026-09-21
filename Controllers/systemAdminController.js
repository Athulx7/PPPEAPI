const {
    authenticateSystemAdmin,
    getDashboardMetrics,
    getAllClients,
    getTemplateConfig,
    provisionClient,
    renewClient,
    toggleClientStatus
} = require('../Repositories/SystemAdmin/systemAdminRepo');
const { createTemplateDatabase } = require('../scripts/generateTemplateDB');

async function loginController(req, res) {
    try {
        const { username, email, password } = req.body;
        const loginIdentifier = username || email;

        if (!loginIdentifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username/Email and password are required'
            });
        }

        const result = await authenticateSystemAdmin(loginIdentifier, password);
        if (!result.success) {
            return res.status(401).json(result);
        }

        return res.status(200).json(result);
    } catch (err) {
        console.error('System Admin Login Error:', err);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during login',
            error: err.message
        });
    }
}

async function getMetricsController(req, res) {
    try {
        const metrics = await getDashboardMetrics();
        return res.status(200).json({
            success: true,
            data: metrics
        });
    } catch (err) {
        console.error('Get Metrics Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve metrics',
            error: err.message
        });
    }
}

async function getClientsController(req, res) {
    try {
        const { search = '', status = 'ALL' } = req.query;
        const clients = await getAllClients(search, status);
        return res.status(200).json({
            success: true,
            data: clients
        });
    } catch (err) {
        console.error('Get Clients Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve clients list',
            error: err.message
        });
    }
}

async function getTemplateConfigController(req, res) {
    try {
        const config = await getTemplateConfig();
        return res.status(200).json({
            success: true,
            data: config
        });
    } catch (err) {
        console.error('Get Template Config Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve template configuration',
            error: err.message
        });
    }
}

async function createClientController(req, res) {
    try {
        const result = await provisionClient(req.body);
        return res.status(201).json(result);
    } catch (err) {
        console.error('Create Client Error:', err);
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to provision client'
        });
    }
}

async function renewClientController(req, res) {
    try {
        const { company_code } = req.params;
        const result = await renewClient(company_code, req.body);
        return res.status(200).json(result);
    } catch (err) {
        console.error('Renew Client Error:', err);
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to update subscription'
        });
    }
}

async function updateStatusController(req, res) {
    try {
        const { company_code } = req.params;
        const { active } = req.body;
        const result = await toggleClientStatus(company_code, active);
        return res.status(200).json(result);
    } catch (err) {
        console.error('Update Status Error:', err);
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to update client status'
        });
    }
}

async function triggerBackupTemplateController(req, res) {
    try {
        const result = await createTemplateDatabase();
        return res.status(200).json(result);
    } catch (err) {
        console.error('Trigger Backup Template Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate template database backup',
            error: err.message
        });
    }
}

module.exports = {
    loginController,
    getMetricsController,
    getClientsController,
    getTemplateConfigController,
    createClientController,
    renewClientController,
    updateStatusController,
    triggerBackupTemplateController
};
