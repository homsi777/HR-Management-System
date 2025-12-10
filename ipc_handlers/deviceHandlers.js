
const { ipcMain, app } = require('electron');
// Updated path: Now in main_services
const zkService = require('../main_services/zkService.js');
let zkNodeService;
try {
    // Updated path: Now in main_services
    zkNodeService = require('../main_services/zkNodeService.js');
} catch (e) {
    console.warn("[DeviceHandler] zkNodeService not loaded (zklib-js-zkteko might be missing).");
}

const db = require('../database');
const { exec } = require('child_process');
const path = require('path');

function registerDeviceHandlers() {
    // --- CRUCIAL FIX: Use the REAL connection test from zkNodeService ---
    ipcMain.handle('device:testConnection', async (_, device) => {
        if (zkNodeService && zkNodeService.testConnectionNode) {
            return await zkNodeService.testConnectionNode(device);
        } else {
            console.error("[DeviceHandler] CRITICAL: zkNodeService or testConnectionNode is not available!");
            return { success: false, message: "مكتبة الاتصال الحقيقية غير مثبتة أو فشلت في التحميل." };
        }
    });

    // This remains as the Mock sync for any potential "Simulate" button if needed in the future.
    ipcMain.handle('device:syncAttendance', async (_, device) => {
        const newRecords = await zkService.syncAttendance(device);
        if (newRecords.length > 0) {
            const insertStmt = db.db.prepare('INSERT INTO attendance (employeeId, date, checkIn, checkOut) VALUES (?, ?, ?, ?)');
            const insertMany = db.db.transaction((records) => {
                for (const record of records) {
                    const existing = db.db.prepare('SELECT id FROM attendance WHERE employeeId = ? AND date = ?').get(record.employeeId, record.date);
                    if(!existing) {
                       insertStmt.run(record.employeeId, record.date, record.checkIn, record.checkOut);
                    }
                }
            });
            insertMany(newRecords);
        }
        return { success: true, message: `تمت المزامنة (Mock). تمت إضافة ${newRecords.length} سجلات جديدة.` };
    });

    // --- Native Node.js Sync Handler ---
    ipcMain.handle('device:syncAttendanceNode', async (_, device) => {
        if (!zkNodeService) {
            return { success: false, message: "مكتبة الاتصال (zklib-js-zkteko) غير مثبتة." };
        }

        try {
            const result = await zkNodeService.syncAttendanceNode(device);
            
            console.log(`[DeviceHandler] Sync result for ${device.ip}:`, result.success ? 'Success' : 'Fail', result.message);

            if (result.success && result.data && result.data.length > 0) {
                const { processedCount, unmatchedCount } = db.processSyncData(result.data);
                
                return { 
                    success: true, 
                    message: `تمت المزامنة. معالجة ${processedCount} سجل، ${unmatchedCount} غير مطابق.` 
                };
            } else {
                return { success: result.success, message: result.message };
            }

        } catch (error) {
            console.error("Sync Node Error:", error);
            return { success: false, message: `خطأ غير متوقع: ${error.message}` };
        }
    });

    ipcMain.handle('device:uploadUsers', async (_, device) => {
        const employees = db.getAll('employees').filter(e => e.status === 'active');
        return await zkService.uploadUsers(device, employees);
    });

    ipcMain.handle('device:runPythonScript', async (_, device) => {
        return new Promise((resolve) => {
            if (!device || !device.ip) {
                resolve({ success: false, message: 'بيانات الجهاز غير صحيحة.' });
                return;
            }

            const isDev = !app.isPackaged;
            const scriptPath = isDev 
                ? path.join(process.cwd(), 'scripts', 'zk_sync.py') 
                : path.join(process.resourcesPath, 'scripts', 'zk_sync.py');

            const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
            const port = device.port || 4370;

            console.log(`[Python Sync] Executing: ${pythonCommand} "${scriptPath}" ${device.ip} ${port}`);

            const options = {
                env: { 
                    ...process.env, 
                    PYTHONIOENCODING: 'utf-8',
                    PYTHONLEGACYWINDOWSSTDIO: 'utf-8' 
                }
            };

            exec(`${pythonCommand} "${scriptPath}" ${device.ip} ${port}`, options, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[Python Sync] Error: ${error.message}`);
                    resolve({ success: false, message: `فشل تشغيل السكربت: تأكد من تثبيت Python ومكتبة zklib. \n${error.message}` });
                    return;
                }
                
                console.log(`[Python Sync] Stdout: ${stdout}`);
                if(stderr) console.warn(`[Python Sync] Stderr: ${stderr}`);
                
                if (stdout.includes('✅ تمت العملية') || stdout.includes('Connection successful')) {
                    resolve({ success: true, message: 'تم تشغيل السكربت وجلب البيانات بنجاح.' });
                } else if (stdout.includes('❌') || stdout.includes('Error')) {
                     // Extract the error message from stdout if possible
                     const lines = stdout.split('\n');
                     const errorLine = lines.find(l => l.includes('Error')) || 'خطأ غير محدد من السكربت';
                     resolve({ success: false, message: `فشل السكربت: ${errorLine}` });
                } else {
                    resolve({ success: true, message: 'تم تنفيذ السكربت. يرجى التحقق من السجلات.' });
                }
            });
        });
    });
}

module.exports = { registerDeviceHandlers };
