
const net = require('net');
const db = require('../database');
const { EventEmitter } = require('events');
const serviceEvents = new EventEmitter();

/**
 * A simple function to parse the specific XML format from the push devices.
 * @param {string} xmlString A single <Message>...</Message> block.
 * @returns {Object} An object with key-value pairs from the XML tags.
 */
function parsePushXml(xmlString) {
    const data = {};
    const messageContent = xmlString.match(/<Message>(.*?)<\/Message>/s);
    if (!messageContent) return data;

    const content = messageContent[1];
    
    const tagRegex = /<([a-zA-Z0-9]+)>(.*?)<\/\1>/g;
    let match;
    while ((match = tagRegex.exec(content)) !== null) {
        data[match[1]] = match[2];
    }
    return data;
}

/**
 * Processes a buffer of raw data received from a TCP socket.
 * @param {Buffer} rawData The raw data buffer.
 * @param {import('electron').BrowserWindow} mainWindow The main window for sending events.
 */
function processData(rawData, mainWindow) {
    try {
        const body = rawData.toString('utf8');
        const xmlMessages = body.split('<?xml version="1.0"?>').filter(msg => msg.trim().startsWith('<Message>'));

        if (xmlMessages.length === 0) {
            console.log('[Push Service] Received data but no valid XML messages found.');
            return;
        }
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('system-event', {
                type: 'info',
                message: 'جاري استقبال بيانات من جهاز دفع فوري...'
            });
        }

        console.log(`[Push Service] Received ${xmlMessages.length} XML message(s) for processing.`);
        
        let recordsToProcess = [];

        xmlMessages.forEach(xmlMsg => {
            const parsedData = parsePushXml(xmlMsg);
            
            if (parsedData.Event === 'TimeLog' && parsedData.UserID) {
                recordsToProcess.push({
                    biometricId: String(parsedData.UserID).trim(),
                    date: `${parsedData.Year}-${String(parsedData.Month).padStart(2, '0')}-${String(parsedData.Day).padStart(2, '0')}`,
                    time: `${String(parsedData.Hour).padStart(2, '0')}:${String(parsedData.Minute).padStart(2, '0')}`
                });
            }
        });

        if (recordsToProcess.length === 0) {
            console.log('[Push Service] No relevant TimeLog events found in the batch.');
            return;
        }
        
        const employees = db.getAll('employees');
        const biometricIdToEmployeeId = new Map(employees.filter(e => e.biometricId).map(e => [String(e.biometricId).trim(), e.id]));

        const processTransaction = db.db.transaction(() => {
            recordsToProcess.forEach(rec => {
                const employeeId = biometricIdToEmployeeId.get(rec.biometricId);
                const employee = employees.find(e => e.id === employeeId);

                if (employee) {
                    const existing = db.db.prepare('SELECT id, checkIn, checkOut FROM attendance WHERE employeeId = ? AND date = ?').get(employee.id, rec.date);
                    if (existing) {
                        const punches = [];
                        if (existing.checkIn) punches.push(existing.checkIn);
                        if (existing.checkOut && existing.checkOut !== existing.checkIn) punches.push(existing.checkOut);
                        punches.push(rec.time);
                        const allPunches = Array.from(new Set(punches)).sort();

                        const newCheckIn = allPunches[0] || null;
                        const newCheckOut = allPunches.length > 1 ? allPunches[allPunches.length - 1] : null;

                        db.db.prepare('UPDATE attendance SET checkIn = ?, checkOut = ? WHERE id = ?').run(newCheckIn, newCheckOut, existing.id);
                    } else {
                        // This is the first check-in of the day, check for lateness
                        if (employee.checkInEndTime && rec.time > employee.checkInEndTime) {
                            console.log(`[Push Service] Lateness detected for ${employee.name} at ${rec.time}.`);
                            serviceEvents.emit('employee-late', { employee, lateTime: rec.time });
                        }
                        db.db.prepare('INSERT INTO attendance (employeeId, date, checkIn, checkOut) VALUES (?, ?, ?, ?)')
                          .run(employee.id, rec.date, rec.time, null);
                    }
                } else {
                    const existingUnmatched = db.db.prepare('SELECT id, punches FROM unmatched_attendance WHERE biometricId = ? AND date = ?').get(rec.biometricId, rec.date);
                    if (existingUnmatched) {
                        const existingPunches = new Set(JSON.parse(existingUnmatched.punches));
                        existingPunches.add(rec.time);
                        const allPunches = JSON.stringify(Array.from(existingPunches).sort());
                        db.db.prepare('UPDATE unmatched_attendance SET punches = ? WHERE id = ?').run(allPunches, existingUnmatched.id);
                    } else {
                        const allPunches = JSON.stringify([rec.time]);
                        db.db.prepare('INSERT INTO unmatched_attendance (biometricId, date, punches) VALUES (?, ?, ?)')
                          .run(rec.biometricId, rec.date, allPunches);
                    }
                    console.warn(`[Push Service] Unmatched biometric ID: ${rec.biometricId}.`);
                }
            });
        });

        processTransaction();
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            console.log('[Push Service] Sending database-updated event to renderer process.');
            mainWindow.webContents.send('database-updated');
            if (recordsToProcess.length > 0) {
                mainWindow.webContents.send('system-event', {
                    type: 'success',
                    message: `تمت معالجة ${recordsToProcess.length} بصمة جديدة بنجاح.`
                });
            }
        }

    } catch (error) {
        console.error('[Push Service] Error processing data:', error);
    }
}


/**
 * Starts the TCP server to listen for real-time push notifications from devices.
 * @param {import('electron').BrowserWindow} mainWindow The main Electron window to send notifications to.
 * @param {(update: object) => void} updateStatusCallback Callback to report service status.
 */
function startServer(mainWindow, updateStatusCallback) {
    const server = net.createServer((socket) => {
        console.log(`[Push Service] Client connected from ${socket.remoteAddress}:${socket.remotePort}`);
        updateStatusCallback({ activity: 'receiving' });
        
        let chunks = [];
        
        socket.on('data', (chunk) => {
            chunks.push(chunk);
        });

        socket.on('end', () => {
            const rawData = Buffer.concat(chunks);
            processData(rawData, mainWindow);
        });

        socket.on('close', () => {
             console.log(`[Push Service] Client disconnected.`);
             updateStatusCallback({ activity: 'idle' });
        });
        
        socket.on('error', (err) => {
            console.error(`[Push Service] Socket Error: ${err.message}`);
        });
    });

    server.listen(5005, '0.0.0.0', () => {
        console.log('Push notification TCP service listening on 0.0.0.0:5005');
        if (updateStatusCallback) {
            updateStatusCallback({ status: 'listening', activity: 'idle', error: null });
        }
    });

    server.on('error', (err) => {
        console.error('[Push Service] Server Start Error:', err.message);
        if (updateStatusCallback) {
            updateStatusCallback({ status: 'error', activity: 'idle', error: err.message });
        }
    });
}

module.exports = { startServer, serviceEvents };
