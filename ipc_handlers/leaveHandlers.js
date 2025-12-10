const { ipcMain } = require('electron');
const db = require('../database');
const smsService = require('../main_services/smsService');

function registerLeaveHandlers() {
    ipcMain.handle('leave:updateStatus', async (_, { requestId, newStatus, reason }) => {
        try {
            db.update('leaveRequests', requestId, { status: newStatus, statusReason: reason });
            
            const enabledSetting = db.getSettings('enableLeaveStatusSms');
            if (enabledSetting && JSON.parse(enabledSetting.value)) {
                const leaveRequest = db.getById('leaveRequests', requestId);
                const employee = db.getById('employees', leaveRequest.employeeId);

                if (employee && employee.phone) {
                    let template = '';
                    if (newStatus === 'Approved') {
                        const templateSetting = db.getSettings('leaveApprovedSmsTemplate');
                        template = templateSetting ? JSON.parse(templateSetting.value) : "عزيزي {employeeName}، تمت الموافقة على طلب الإجازة الخاص بك من {startDate} إلى {endDate}.";
                    } else if (newStatus === 'Rejected') {
                        const templateSetting = db.getSettings('leaveRejectedSmsTemplate');
                        template = templateSetting ? JSON.parse(templateSetting.value) : "عزيزي {employeeName}، نعتذر عن عدم قبول طلب الإجازة الخاص بك من {startDate} إلى {endDate}. السبب: {reason}";
                    }

                    if (template) {
                        const text = template
                            .replace('{employeeName}', employee.name)
                            .replace('{startDate}', leaveRequest.startDate)
                            .replace('{endDate}', leaveRequest.endDate)
                            .replace('{reason}', reason || 'غير محدد');
                        await smsService.queueSmsForSending({ recipientName: employee.name, recipientPhone: employee.phone, text, priority: 'HIGH', origin: 'LEAVE' });
                    }
                }
            }
            return { success: true, message: 'تم تحديث حالة الطلب بنجاح.' };
        } catch (error) {
            console.error('[Leave] Error updating status:', error);
            return { success: false, message: `فشل تحديث الحالة: ${error.message}` };
        }
    });
}

module.exports = { registerLeaveHandlers };
