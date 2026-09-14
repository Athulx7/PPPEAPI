const sql = require("mssql");
const { generatePayrollForPeriodRepo } = require("../Repositories/Payroll/payrollGeneratorRepo");

async function checkAndRunScheduledPayroll(pool) {
    try {
        const today = new Date();
        const currentDay = today.getDate();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        // 1. Fetch general payroll settings from tbl_payrollsettings_general
        let processingDay = 25;
        let enableAutoPayroll = false;

        try {
            const configResult = await pool.request().query(`
                SELECT TOP 1 processing_day, enable_auto_payroll, is_active
                FROM tbl_payrollsettings_general
                WHERE is_active = 1
            `);

            if (configResult.recordset && configResult.recordset.length > 0) {
                const setting = configResult.recordset[0];
                enableAutoPayroll = Boolean(setting.enable_auto_payroll);
                const dayVal = parseInt(setting.processing_day);
                if (!isNaN(dayVal) && dayVal >= 1 && dayVal <= 31) {
                    processingDay = dayVal;
                }
            }
        } catch (e) {
            console.log("[PayrollScheduler] Warning querying tbl_payrollsettings_general:", e.message);
        }

        // If auto-payroll is disabled, do nothing
        if (!enableAutoPayroll) {
            return;
        }

        // Only run on the processing_day configured in tbl_payrollsettings_general
        if (currentDay !== processingDay) {
            return;
        }

        // 2. Check if payroll for current month/year has already been generated
        const checkResult = await pool.request().query(`
            SELECT COUNT(*) AS count 
            FROM tbl_payroll_run 
            WHERE period_month = ${currentMonth} 
              AND period_year = ${currentYear} 
              AND status = 'completed'
        `);

        if (checkResult.recordset && checkResult.recordset[0].count > 0) {
            return; // Already completed for current period
        }

        console.log(`[PayrollScheduler] Executing Midnight Auto-Payroll for period ${currentMonth}/${currentYear} (processing_day: ${processingDay})...`);
        const mockReq = {
            tenantDB: pool,
            user: { emp_code: 'AUTO_SCHEDULER', user_code: 'AUTO_SCHEDULER' }
        };

        const result = await generatePayrollForPeriodRepo(mockReq, {
            month: currentMonth,
            year: currentYear,
            run_type: 'scheduled'
        });

        console.log(`[PayrollScheduler] Auto-payroll completed successfully: Run Code ${result.payroll_run_code}`);
    } catch (err) {
        console.error("[PayrollScheduler] Error executing scheduled payroll:", err.message);
    }
}

function initPayrollScheduler(dbPoolSupplier) {
    console.log("[PayrollScheduler] Service initialized for Midnight Auto-Payroll triggers.");

    // Function to calculate time remaining until next 12:00 AM Midnight
    const getMsUntilMidnight = () => {
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
        return midnight.getTime() - now.getTime();
    };

    const runDailySchedulerLoop = async () => {
        try {
            if (typeof dbPoolSupplier === 'function') {
                const pools = await dbPoolSupplier();
                if (Array.isArray(pools)) {
                    for (const pool of pools) {
                        await checkAndRunScheduledPayroll(pool);
                    }
                } else if (pools) {
                    await checkAndRunScheduledPayroll(pools);
                }
            }
        } catch (err) {
            console.error("[PayrollScheduler] Scheduler execution error:", err.message);
        }

        // Schedule next check for midnight (24 hour loop)
        const msUntilNextMidnight = getMsUntilMidnight();
        setTimeout(runDailySchedulerLoop, msUntilNextMidnight);
    };

    // Run initial check on startup
    runDailySchedulerLoop();
}

module.exports = {
    initPayrollScheduler,
    checkAndRunScheduledPayroll
};
