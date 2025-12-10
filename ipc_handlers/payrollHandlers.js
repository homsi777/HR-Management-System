const { ipcMain } = require('electron');
const db = require('../database');
const smsService = require('../main_services/smsService');

function registerPayrollHandlers() {
    ipcMain.handle('payroll:deliverSalary', async (_, payload) => {
        // payload can now contain { employeeId, year, month, weekNumber, advanceIdsToDeduct }
        const result = db.deliverSalary(payload);
        if (result.success && result.payment) {
            try {
                const enabledSetting = db.getSettings('enableSalarySms');
                if (enabledSetting && JSON.parse(enabledSetting.value)) {
                    const employee = db.getById('employees', result.payment.employeeId);
                    if (employee && employee.phone) {
                        const templateSetting = db.getSettings('salarySmsTemplate');
                        const template = templateSetting ? JSON.parse(templateSetting.value) : "عزيزي {employeeName}، تم تحويل راتبك عن شهر {month}/{year} بقيمة {netAmount} {currency}.";
                        const text = template
                            .replace('{employeeName}', employee.name)
                            .replace('{month}', result.payment.month)
                            .replace('{year}', result.payment.year)
                            .replace('{netAmount}', result.payment.netAmount.toFixed(2))
                            .replace('{currency}', employee.salaryCurrency || 'SYP');
                        
                        await smsService.queueSmsForSending({ recipientName: employee.name, recipientPhone: employee.phone, text, priority: 'MEDIUM', origin: 'SALARY' });
                    }
                }
            } catch (smsError) {
                console.error('[SMS] Failed to send salary notification:', smsError);
            }
        }
        return { success: result.success, message: result.message };
    });

    ipcMain.handle('payroll:calculate', async (_, { employeeId, startDate, endDate }) => {
        return db.calculatePayrollForEmployee(employeeId, startDate, endDate);
    });
}

module.exports = { registerPayrollHandlers };