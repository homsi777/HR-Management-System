

const { ipcMain, dialog, BrowserWindow, app } = require('electron');
const db = require('../database');
const activationCodes = require('../activationCodes');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const cloudSyncService = require('../main_services/cloudSyncService');

function registerAppHandlers(mainWindow) {
    // UPDATED VERIFICATION HANDLER - Now handles explicit cloud sync toggle
    ipcMain.handle('app:verifyActivationCode', (_, payload) => {
        const code = (typeof payload === 'string' ? payload : payload.code).toUpperCase().trim();
        const enableCloudRequest = payload.enableCloud; // Extract the user's choice
        const validCodes = activationCodes.codes;

        if (validCodes.includes(code)) {
            const detectedType = activationCodes.getTypeFromCode(code);
            
            if (detectedType) {
                // If user selected a type in UI but code doesn't match, reject it (Frontend handles this too, but backend check is safe)
                if (payload.type && detectedType !== payload.type) {
                     return { success: false, message: `رمز التفعيل هذا مخصص لنسخة ${detectedType} وليس ${payload.type}.` };
                }

                db.updateSettings('isActivated', true);
                db.updateSettings('isTrial', false);
                db.updateSettings('licenseType', detectedType);

                // CRITICAL: Handle Cloud Sync Setting
                if (detectedType === 'Full') {
                    // Save the sync key regardless
                    db.updateSettings('syncKey', code); 
                    
                    // Enable cloud sync only if user checked the box
                    if (enableCloudRequest === true) {
                        db.updateSettings('cloudSyncEnabled', true);
                        console.log(`[Activation] Full license activated. Cloud sync ENABLED.`);
                    } else {
                        db.updateSettings('cloudSyncEnabled', false);
                        console.log(`[Activation] Full license activated. Cloud sync DISABLED by user.`);
                    }
                } else {
                    // Non-Full versions cannot have cloud sync
                    db.updateSettings('syncKey', null);
                    db.updateSettings('cloudSyncEnabled', false);
                    console.log(`[Activation] ${detectedType} license activated. Cloud sync disabled.`);
                }

                return { success: true, message: `تم تفعيل نسخة ${detectedType} بنجاح.` };
            } else {
                return { success: false, message: 'رمز صحيح ولكن تعذر تحديد نوع الرخصة.' };
            }
        }
        
        return { success: false, message: 'رمز التفعيل غير صالح.' };
    });

    // DISABLED: Export Activation Codes (Security Measure)
    ipcMain.handle('app:getActivationCodes', () => {
        return { success: false, message: "تم تعطيل استخراج الرموز لأسباب أمنية.", data: [] };
    });
    
    ipcMain.handle('app:resolveUnmatchedRecord', (_, payload) => {
        try {
            return db.resolveUnmatchedRecord(payload);
        } catch (error) {
            console.error('Failed to resolve unmatched record:', error);
            return { success: false, message: `فشل: ${error.message}` };
        }
    });

    ipcMain.handle('app:terminateEmployee', async (_, payload) => {
        return db.terminateEmployee(payload);
    });

    ipcMain.handle('app:createVisitorQueue', async (_, visitorName) => {
        return db.createVisitorEntry(visitorName);
    });

    ipcMain.handle('app:showOpenDialog', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Import Database',
            filters: [{ name: 'Database Files', extensions: ['db'] }],
            properties: ['openFile']
        });
        return { canceled, filePath: filePaths ? filePaths[0] : undefined };
    });

    // Cloud Sync Handlers
    ipcMain.handle('app:syncToCloud', async () => {
        return await cloudSyncService.uploadNewRecords();
    });

    ipcMain.handle('app:downloadFromCloud', async () => {
        const result = await cloudSyncService.downloadCloudRecords();
        // If data was changed, notify frontend to refresh
        if (result.success && result.count > 0 && mainWindow) {
            mainWindow.webContents.send('database-updated');
        }
        return result;
    });

    // New handler to launch external tools
    ipcMain.handle('app:launch-tool', async (_, toolName) => {
        const tools = {
            'zk_pro': 'zk_pro.exe',
            'timy': 'FingerprintTool.exe'
        };

        const fileName = tools[toolName];
        if (!fileName) {
            return { success: false, message: 'أداة غير معروفة.' };
        }

        // Determine the path based on environment (Dev vs Prod)
        let toolPath;
        if (app.isPackaged) {
            // In production, 'extraFiles' puts the .exe next to the main executable.
            // app.getPath('exe') gives the full path to the app executable.
            // path.dirname(...) gets the folder containing the app.
            toolPath = path.join(path.dirname(app.getPath('exe')), fileName);
        } else {
            // In development, assume files are in the project root.
            toolPath = path.join(process.cwd(), fileName);
        }

        if (!fs.existsSync(toolPath)) {
            console.error(`[App] Tool not found at: ${toolPath}`);
            return { success: false, message: `لم يتم العثور على ملف الأداة.\nالمسار المتوقع: ${toolPath}\nتأكد من وجود الملف ${fileName} في مجلد التثبيت.` };
        }

        try {
            console.log(`[App] Launching tool: ${toolPath}`);
            // Use execFile to run the exe. unref() allows it to run independently of the main process.
            const child = execFile(toolPath, [], (error) => {
                if (error) {
                    console.error(`[App] Error executing tool: ${error}`);
                }
            });
            child.unref(); 
            return { success: true, message: `تم تشغيل الأداة: ${fileName}` };
        } catch (error) {
            console.error(`[App] Exception launching tool:`, error);
            return { success: false, message: `خطأ أثناء التشغيل: ${error.message}` };
        }
    });

    ipcMain.handle('app:print', (event, { content, printOptions }) => {
        // If content is provided, create a new hidden window and print that content
        if (content) {
            const printWindow = new BrowserWindow({
                show: false, // Set to true for debugging
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                },
            });
    
            const finalHtml = `
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { margin: 0; }
                        /* User mentioned 58mm and 80mm. Let's default to 58mm for now. */
                        @page { size: 58mm; margin: 2mm 3mm; }
                        .receipt-content { direction: rtl; font-family: monospace; font-size: 8pt; line-height: 1.4; color: black; }
                        .receipt-content h3 { font-size: 9pt; font-weight: bold; text-align: center; margin: 0; padding: 0; }
                        .receipt-content p { margin: 2px 0; }
                        .receipt-content .line { border-top: 1px dashed black; margin: 4px 0; }
                        .receipt-content .details { margin: 5px 0; }
                        .receipt-content .details div { display: flex; justify-content: space-between; }
                        .receipt-content .total { font-weight: bold; font-size: 9pt; }
                        .receipt-content .signature { margin-top: 20px; padding-bottom: 10px; }
                        
                        /* Specific styles for Queue Ticket */
                        .queue-ticket { text-align: center; font-family: sans-serif; }
                        .queue-project-name { font-size: 12pt; font-weight: bold; margin-bottom: 10px; border-bottom: 2px solid black; padding-bottom: 5px; }
                        .queue-label { font-size: 10pt; margin-top: 10px; }
                        .queue-number { font-size: 32pt; font-weight: bold; margin: 10px 0; line-height: 1; }
                        .queue-time { font-size: 8pt; color: #333; margin-bottom: 10px; }
                        .queue-footer { font-size: 8pt; margin-top: 10px; border-top: 1px dashed #666; padding-top: 5px; }
                    </style>
                </head>
                <body>${content}</body>
                </html>
            `;
    
            printWindow.loadURL("data:text/html;charset=utf-8," + encodeURI(finalHtml));
    
            printWindow.webContents.on('did-finish-load', () => {
                const options = {
                    silent: false, // Show print dialog for user to select thermal printer
                    ...printOptions,
                };
                printWindow.webContents.print(options, (success, errorType) => {
                    if (!success && errorType) {
                        console.log(`Receipt print failed: ${errorType}`);
                    }
                    // Close the window after printing
                    setTimeout(() => {
                        if (printWindow && !printWindow.isDestroyed()) {
                            printWindow.close();
                        }
                    }, 500);
                });
            });
        } else {
            // If no content, print the main window's visible content
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.print({ silent: false, ...printOptions }, (success, errorType) => {
                    if (!success && errorType) {
                        console.log(`Main window print failed: ${errorType}`);
                    }
                });
            }
        }
    });
}

module.exports = { registerAppHandlers };
