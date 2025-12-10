
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    db: {
        getAll: (table) => ipcRenderer.invoke('db:getAll', table),
        getById: (table, id) => ipcRenderer.invoke('db:getById', table, id),
        insert: (table, data) => ipcRenderer.invoke('db:insert', table, data),
        update: (table, id, data) => ipcRenderer.invoke('db:update', table, id, data),
        delete: (table, id) => ipcRenderer.invoke('db:delete', table, id),
        getSettings: (key) => ipcRenderer.invoke('db:getSettings', key),
        updateSettings: (key, value) => ipcRenderer.invoke('db:updateSettings', key, value),
        clearAllData: (confirmationText) => ipcRenderer.invoke('db:clearAllData', confirmationText),
        export: () => ipcRenderer.invoke('db:export'),
        import: (filePath) => ipcRenderer.invoke('db:import', filePath),
    },
    auth: {
        login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
    },
    device: {
        testConnection: (device) => ipcRenderer.invoke('device:testConnection', device),
        syncAttendance: (device) => ipcRenderer.invoke('device:syncAttendance', device),
        syncAttendanceNode: (device) => ipcRenderer.invoke('device:syncAttendanceNode', device),
        uploadUsers: (device) => ipcRenderer.invoke('device:uploadUsers', device),
        runPythonScript: (device) => ipcRenderer.invoke('device:runPythonScript', device),
    },
    app: {
        verifyActivationCode: (code) => ipcRenderer.invoke('app:verifyActivationCode', code),
        resolveUnmatchedRecord: (payload) => ipcRenderer.invoke('app:resolveUnmatchedRecord', payload),
        showOpenDialog: () => ipcRenderer.invoke('app:showOpenDialog'),
        print: (options) => ipcRenderer.invoke('app:print', options),
        terminateEmployee: (payload) => ipcRenderer.invoke('app:terminateEmployee', payload),
        createVisitorQueue: (visitorName) => ipcRenderer.invoke('app:createVisitorQueue', visitorName),
        launchTool: (toolName) => ipcRenderer.invoke('app:launch-tool', toolName),
        syncToCloud: () => ipcRenderer.invoke('app:syncToCloud'),
        downloadFromCloud: () => ipcRenderer.invoke('app:downloadFromCloud'),
        onDatabaseUpdate: (callback) => {
            const channel = 'database-updated';
            // Set up the listener
            ipcRenderer.on(channel, (event, ...args) => callback(...args));
            // Return a cleanup function to remove the listener
            return () => {
                ipcRenderer.removeAllListeners(channel);
            };
        },
        onSystemEvent: (callback) => {
            const channel = 'system-event';
            ipcRenderer.on(channel, (event, ...args) => callback(args[0]));
            return () => {
                ipcRenderer.removeAllListeners(channel);
            };
        },
        onSystemStatusUpdate: (callback) => {
            const channel = 'system-status-update';
            ipcRenderer.on(channel, (event, ...args) => callback(args[0]));
            return () => {
                ipcRenderer.removeAllListeners(channel);
            };
        },
        onFileDetected: (callback) => {
            const channel = 'import:file-detected';
            ipcRenderer.on(channel, (event, filename) => callback(filename));
            return () => {
                ipcRenderer.removeAllListeners(channel);
            };
        },
        processImportFile: (filename) => ipcRenderer.invoke('import:process-file', filename),
    },
    payroll: {
        deliverSalary: (payload) => ipcRenderer.invoke('payroll:deliverSalary', payload),
        calculate: (payload) => ipcRenderer.invoke('payroll:calculate', payload),
    },
    leave: {
        updateStatus: (payload) => ipcRenderer.invoke('leave:updateStatus', payload),
    },
    scanner: {
        listPorts: () => ipcRenderer.invoke('scanner:list-ports'),
        startListener: (config) => ipcRenderer.send('scanner:start-listener', config),
        stopListener: () => ipcRenderer.send('scanner:stop-listener'),
        onScanData: (callback) => {
            ipcRenderer.on('scanner:data', (_event, data) => callback(data));
        },
        onScanError: (callback) => {
            ipcRenderer.on('scanner:error', (_event, error) => callback(error));
        },
        removeListeners: () => {
            ipcRenderer.removeAllListeners('scanner:data');
            ipcRenderer.removeAllListeners('scanner:error');
        }
    },
    sms: {
        send: (message) => ipcRenderer.invoke('sms:send', message),
        getLog: () => ipcRenderer.invoke('sms:getLog'),
    }
});
