
const { registerDbHandlers } = require('./dbHandlers');
const { registerAppHandlers } = require('./appHandlers');
const { registerAuthHandlers } = require('./authHandlers');
const { registerDeviceHandlers } = require('./deviceHandlers');
const { registerPayrollHandlers } = require('./payrollHandlers');
const { registerLeaveHandlers } = require('./leaveHandlers');
const { registerSmsHandlers } = require('./smsHandlers');
const { registerScannerHandlers } = require('./scannerHandlers');
const { registerFileHandlers } = require('./fileHandlers');

function registerIpcHandlers(mainWindow) {
    registerDbHandlers(mainWindow);
    registerAppHandlers(mainWindow);
    registerAuthHandlers();
    registerDeviceHandlers();
    registerPayrollHandlers();
    registerLeaveHandlers();
    registerSmsHandlers();
    registerScannerHandlers();
    registerFileHandlers();
}

module.exports = { registerIpcHandlers };
