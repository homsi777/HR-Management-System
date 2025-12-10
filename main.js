
const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const db = require('./database');
// Updated path: Now looking in main_services
const pushService = require('./main_services/pushService.js');
const { startApiServer } = require('./main_services/apiServer');
const smsService = require('./main_services/smsService');
const scannerService = require('./main_services/scannerService');
const fileImportService = require('./main_services/fileImportService');
const { registerIpcHandlers } = require('./ipc_handlers');

const isDev = process.env.NODE_ENV === 'development';
let mainWindow;

let systemStatus = {
    apiServer: { status: 'inactive', activity: 'idle', port: '3001 & 3002', error: null },
    pushService: { status: 'inactive', activity: 'idle', port: 5005, error: null }
};

function sendStatusUpdate() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('system-status-update', systemStatus);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // Force open DevTools in development to see API Server logs
        mainWindow.webContents.openDevTools();
        console.log('[Main] Development mode: DevTools opened.');
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }

    mainWindow.webContents.on('did-finish-load', () => {
        // Send initial status when frontend is ready
        sendStatusUpdate();
    });
}


app.whenReady().then(() => {
    // Handle media permission requests (for webcam)
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
        if (permission === 'media' && details.mediaTypes.includes('video')) {
            // Automatically grant camera permission. 
            // In a production app, you might want a custom prompt.
            callback(true);
        } else {
            // Deny other requests.
            callback(false);
        }
    });

    db.initialize(app); // Initialize the database now that the app is ready
    smsService.loadSmsSettings(); // Load SMS settings on startup

    // Listen for late employee events from the push service
    pushService.serviceEvents.on('employee-late', async ({ employee, lateTime }) => {
        console.log(`[Main] Received employee-late event for ${employee.name}`);
        try {
            const enabledSetting = db.getSettings('enableLateAttendanceSms');
            const isEnabled = enabledSetting ? JSON.parse(enabledSetting.value) : true;
    
            if (!isEnabled) {
                console.log('[Main] Late attendance SMS is disabled. Skipping.');
                return;
            }
            
            if (!employee.phone) {
                console.log(`[Main] Cannot send late SMS to ${employee.name}, no phone number.`);
                return;
            }
    
            const templateSetting = db.getSettings('lateAttendanceSmsTemplate');
            const template = templateSetting ? JSON.parse(templateSetting.value) : "تنبيه تأخير: تم تسجيل حضورك اليوم {employeeName} الساعة {time}. نرجو الالتزام بمواعيد الدوام.";
            
            const text = template
                .replace('{employeeName}', employee.name)
                .replace('{time}', lateTime);
    
            console.log(`[Main] Queuing late SMS for ${employee.name}: "${text}"`);
    
            await smsService.queueSmsForSending({
                recipientName: employee.name,
                recipientPhone: employee.phone,
                text: text,
                priority: 'HIGH',
                origin: 'ATTENDANCE',
            });
    
        } catch (error) {
            console.error('[Main] Error handling employee-late event:', error);
        }
    });

    createWindow();
    
    // Register all IPC handlers
    registerIpcHandlers(mainWindow);
    
    // Start background services
    startApiServer(mainWindow, (update) => {
        systemStatus.apiServer = { ...systemStatus.apiServer, ...update };
        sendStatusUpdate();
    });
    pushService.startServer(mainWindow, (update) => {
        systemStatus.pushService = { ...systemStatus.pushService, ...update };
        sendStatusUpdate();
    });
    scannerService.initialize(mainWindow);
    smsService.startQueueProcessor(mainWindow);
    
    // Start File Watcher for automatic imports
    fileImportService.setupWatcher(mainWindow);


    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    scannerService.cleanup(); // Cleanup scanner port on exit
    db.close();
});
