const { ipcMain } = require('electron');
const db = require('../database');
const smsService = require('../main_services/smsService');

function registerSmsHandlers() {
    ipcMain.handle('sms:send', async (_, message) => {
        return smsService.queueSmsForSending(message);
    });

    ipcMain.handle('sms:getLog', async () => {
        try {
            // Get all and sort by date descending
            return db.getAll('sms_log').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            console.error('[SMS] Error getting log:', error);
            return [];
        }
    });
}

module.exports = { registerSmsHandlers };
