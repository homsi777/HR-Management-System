
const { ipcMain } = require('electron');
const fileImportService = require('../main_services/fileImportService');

function registerFileHandlers() {
    ipcMain.handle('import:process-file', async (_, filename) => {
        return await fileImportService.processFile(filename);
    });
}

module.exports = { registerFileHandlers };
