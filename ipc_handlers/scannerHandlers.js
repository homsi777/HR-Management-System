const { ipcMain } = require('electron');
const scannerService = require('../main_services/scannerService');

function registerScannerHandlers() {
    ipcMain.handle('scanner:list-ports', async () => {
        if (!scannerService.checkDependencies()) {
            return [];
        }
        return scannerService.listPorts();
    });

    ipcMain.on('scanner:start-listener', (event, { port, baudRate }) => {
        if (!scannerService.checkDependencies()) {
            return;
        }
        scannerService.startListener(port, baudRate);
    });

    ipcMain.on('scanner:stop-listener', () => {
        scannerService.cleanup();
    });
}

module.exports = { registerScannerHandlers };
