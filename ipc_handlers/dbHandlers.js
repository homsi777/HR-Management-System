
const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const db = require('../database');
const bcrypt = require('bcryptjs');

function registerDbHandlers(mainWindow) {
    ipcMain.handle('db:getAll', (_, table) => db.getAll(table));
    ipcMain.handle('db:getById', (_, table, id) => db.getById(table, id));
    
    ipcMain.handle('db:insert', (_, table, data) => {
        // Automatically hash password on user creation
        if (table === 'users' && data.password) {
            data.password = bcrypt.hashSync(data.password, 10);
        }
        return db.insert(table, data);
    });

    ipcMain.handle('db:update', (_, table, id, data) => {
        // Automatically hash password on user update
        if (table === 'users' && data.password && data.password.trim() !== '') {
            data.password = bcrypt.hashSync(data.password, 10);
        }
        return db.update(table, id, data);
    });
    
    ipcMain.handle('db:delete', (_, table, id) => {
        if (table === 'employees') {
            // The invoke handler automatically catches errors and rejects the promise.
            return db.deleteEmployeeAndRelatedData(id);
        }
        return db.deleteRow(table, id);
    });

    ipcMain.handle('db:getSettings', (_, key) => db.getSettings(key));
    ipcMain.handle('db:updateSettings', (_, key, value) => db.updateSettings(key, value));

    ipcMain.handle('db:clearAllData', (_, confirmationText) => {
        if (confirmationText !== 'مسح') {
            return { success: false, message: 'النص التأكيدي غير صحيح.' };
        }
        return db.clearAllData();
    });

    ipcMain.handle('db:export', async () => {
        try {
            const dbPath = path.join(app.getPath('userData'), 'database.db');
            const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
                title: 'Export Database',
                defaultPath: `hr_backup_${new Date().toISOString().split('T')[0]}.db`,
                filters: [{ name: 'Database Files', extensions: ['db'] }]
            });

            if (canceled || !filePath) {
                return { success: false, message: 'تم إلغاء عملية التصدير.' };
            }

            fs.copyFileSync(dbPath, filePath);
            return { success: true, message: `تم تصدير قاعدة البيانات بنجاح إلى ${filePath}` };
        } catch (error) {
            console.error('Failed to export database:', error);
            return { success: false, message: `فشل التصدير: ${error.message}` };
        }
    });
    
    ipcMain.handle('db:import', async (_, filePath) => {
        // The new "smart" import logic is handled entirely in the database module.
        const result = db.importDataFromBackup(filePath);
    
        if (result.success) {
            // On success, we still need to reload the window to fetch all the new data.
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('database-updated');
                mainWindow.reload();
            }
        }
        
        // Return the result (success or failure message) to the frontend.
        return result;
    });
}

module.exports = { registerDbHandlers };