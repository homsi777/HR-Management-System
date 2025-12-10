const { ipcMain } = require('electron');
const db = require('../database');

function registerAuthHandlers() {
    ipcMain.handle('auth:login', (_, username, password) => db.login(username, password));
}

module.exports = { registerAuthHandlers };
