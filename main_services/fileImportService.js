
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { app } = require('electron');
const db = require('../database');

let watcher = null;
let mainWindow = null;
const importFolder = path.join(app.getPath('documents'), 'Alamia Attendance Imports');
const processedFolder = path.join(importFolder, 'Processed');

// Ensure folders exist
function ensureDirectories() {
    if (!fs.existsSync(importFolder)) {
        fs.mkdirSync(importFolder, { recursive: true });
    }
    if (!fs.existsSync(processedFolder)) {
        fs.mkdirSync(processedFolder, { recursive: true });
    }
}

function setupWatcher(win) {
    mainWindow = win;
    ensureDirectories();

    console.log(`[File Watcher] Watching folder: ${importFolder}`);

    try {
        watcher = fs.watch(importFolder, (eventType, filename) => {
            if (filename && eventType === 'rename') {
                const filePath = path.join(importFolder, filename);
                // Check if file exists (it might be a deletion event) and is a file
                // Add a small delay to ensure file write is complete
                setTimeout(() => {
                    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
                        const ext = path.extname(filename).toLowerCase();
                        if (['.xlsx', '.xls', '.csv'].includes(ext)) {
                            console.log(`[File Watcher] New file detected: ${filename}`);
                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send('import:file-detected', filename);
                            }
                        }
                    }
                }, 500);
            }
        });
    } catch (error) {
        console.error('[File Watcher] Error starting watcher:', error);
    }
}

// Helper to clean string from quotes and extra spaces
function cleanString(str) {
    if (!str) return '';
    return String(str).replace(/['"]/g, '').trim();
}

function findColumnHeader(headers, keywords) {
    if (!Array.isArray(headers)) return -1;
    // Clean headers first
    const cleanedHeaders = headers.map(h => cleanString(h).toLowerCase());
    
    for (const keyword of keywords) {
        const index = cleanedHeaders.findIndex(h => h.includes(keyword.toLowerCase()));
        if (index !== -1) return index;
    }
    return -1;
}

function detectHeaders(rawData) {
    let headerRowIndex = -1;
    let userIdColIdx = -1;
    let dateColIdx = -1;
    let timeColIdx = -1;

    // Keywords for smart detection (Arabic and English)
    const userIdKeywords = ['كود', 'رقم الموظف', 'المعرف', 'user id', 'userid', 'badge', 'enroll', 'ac-no', 'no.', 'رقم'];
    const dateKeywords = ['تاريخ', 'date', 'day', 'time']; // Sometimes date and time are in one column called 'Time'
    const timeKeywords = ['وقت', 'time', 'clock', 'ساعة'];

    // Scan first 10 rows to find headers
    for (let i = 0; i < Math.min(20, rawData.length); i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;

        const potentialUserId = findColumnHeader(row, userIdKeywords);
        const potentialDate = findColumnHeader(row, dateKeywords);
        
        // We need at least UserID and Date to proceed
        if (potentialUserId !== -1 && potentialDate !== -1) {
            headerRowIndex = i;
            userIdColIdx = potentialUserId;
            dateColIdx = potentialDate;
            timeColIdx = findColumnHeader(row, timeKeywords); 
            
            // If time column not found, maybe date column implies datetime
            if (timeColIdx === -1 && (cleanString(row[dateColIdx]).toLowerCase().includes('time') || cleanString(row[dateColIdx]).toLowerCase().includes('وقت'))) {
                // Just a heuristic
            }
            break;
        }
    }

    return { headerRowIndex, userIdColIdx, dateColIdx, timeColIdx };
}

async function processFile(filename) {
    const filePath = path.join(importFolder, filename);
    if (!fs.existsSync(filePath)) {
        return { success: false, message: 'الملف لم يعد موجوداً.' };
    }

    try {
        console.log(`[Import] Reading file: ${filePath}`);
        
        // Strategy 1: Read with default settings (UTF-8 usually)
        let workbook = XLSX.readFile(filePath, { cellDates: true });
        let rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });
        
        let { headerRowIndex, userIdColIdx, dateColIdx, timeColIdx } = detectHeaders(rawData);

        // Log the first row for debugging
        if (rawData.length > 0) {
            console.log('[Import] First row (Default Encoding):', JSON.stringify(rawData[0]));
        }

        // Strategy 2: If headers not found, try reading with Arabic Encoding (CP1256)
        if (userIdColIdx === -1) {
            console.log('[Import] Headers not found. Retrying with Arabic Encoding (CP1256)...');
            try {
                const fileBuffer = fs.readFileSync(filePath);
                // 'type: buffer' and 'codepage: 1256' forces the parser to treat it as Windows-1256
                workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, codepage: 1256 });
                rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });
                
                // Log the first row again after re-reading
                if (rawData.length > 0) {
                    console.log('[Import] First row (CP1256):', JSON.stringify(rawData[0]));
                }

                const detection = detectHeaders(rawData);
                headerRowIndex = detection.headerRowIndex;
                userIdColIdx = detection.userIdColIdx;
                dateColIdx = detection.dateColIdx;
                timeColIdx = detection.timeColIdx;

            } catch (retryErr) {
                console.error('[Import] Retry with CP1256 failed:', retryErr);
            }
        }

        if (userIdColIdx === -1) {
             return { 
                 success: false, 
                 message: `لم يتم التعرف على الأعمدة. تأكد أن الملف يحتوي على 'كود الموظف' و 'تاريخ'. (أول سطر تمت قراءته: ${JSON.stringify(rawData[0] || 'فارغ')})` 
             };
        }

        console.log(`[Import] Headers found at row ${headerRowIndex}. Indices -> UserID: ${userIdColIdx}, Date: ${dateColIdx}, Time: ${timeColIdx}`);

        const recordsToSync = [];

        // Iterate over data rows (skipping header)
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
            const row = rawData[i];
            
            // Get User ID and clean it (remove leading zeros)
            let userIdRaw = cleanString(row[userIdColIdx]);
            if (!userIdRaw) continue;
            const userId = parseInt(userIdRaw, 10).toString(); 

            // Get Date and Time
            let dateVal = row[dateColIdx];
            let timeVal = timeColIdx !== -1 ? row[timeColIdx] : '';

            let dateObj = null;

            // Helper to parse "11/20/2025" vs "20/11/2025"
            const parseDateString = (dStr, tStr) => {
                if (!dStr) return null;
                dStr = cleanString(dStr);
                tStr = cleanString(tStr);
                const dateTimeStr = tStr ? `${dStr} ${tStr}` : dStr;
                
                let d = new Date(dateTimeStr);
                // Validation: check if valid and year is reasonable
                if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;

                // Try MM/DD/YYYY vs DD/MM/YYYY ambiguity handling
                // Split by common separators
                const parts = dStr.split(/[\/\-\.]/);
                if (parts.length === 3) {
                    // Try swapping first two parts (switch Day and Month)
                    const swappedStr = `${parts[1]}/${parts[0]}/${parts[2]} ${tStr}`;
                    d = new Date(swappedStr);
                    if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;
                }
                return null;
            };

            if (dateVal instanceof Date) {
                dateObj = dateVal;
                if (timeVal) {
                    // If time is string "03:46:05"
                    if (typeof timeVal === 'string') {
                        const [h, m, s] = timeVal.split(':').map(Number);
                        if (!isNaN(h)) dateObj.setHours(h || 0, m || 0, s || 0);
                    } 
                    // If time is mostly Excel fractional day (0.5 = 12:00 PM), usually xlsx handles this if cellDates=true
                    // but assuming string for CSV mainly.
                }
            } else {
                dateObj = parseDateString(dateVal, timeVal);
            }

            if (dateObj && !isNaN(dateObj.getTime())) {
                const yyyy = dateObj.getFullYear();
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const dd = String(dateObj.getDate()).padStart(2, '0');
                const hh = String(dateObj.getHours()).padStart(2, '0');
                const min = String(dateObj.getMinutes()).padStart(2, '0');
                const ss = String(dateObj.getSeconds()).padStart(2, '0');
                
                if (yyyy > 2000 && yyyy < 2100) {
                    const timestamp = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
                    recordsToSync.push({
                        user_id: userId,
                        timestamp: timestamp
                    });
                }
            }
        }

        if (recordsToSync.length === 0) {
             return { success: false, message: 'لم يتم العثور على سجلات تواريخ صالحة بعد المعالجة.' };
        }

        console.log(`[Import] Found ${recordsToSync.length} valid records. Sending to DB...`);
        const result = db.processSyncData(recordsToSync);

        // Move file to Processed folder
        const destPath = path.join(processedFolder, `${path.basename(filename, path.extname(filename))}_${Date.now()}${path.extname(filename)}`);
        try {
            fs.renameSync(filePath, destPath);
        } catch (moveErr) {
            console.error("Could not move file:", moveErr);
        }

        return { 
            success: true, 
            message: `تم استيراد ${result.processedCount} سجل بنجاح. (بصمات جديدة: ${result.processedCount})`,
            stats: result
        };

    } catch (error) {
        console.error('[Import] Error processing file:', error);
        return { success: false, message: `خطأ أثناء قراءة الملف: ${error.message}` };
    }
}

module.exports = {
    setupWatcher,
    processFile
};
