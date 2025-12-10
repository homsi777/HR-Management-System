const { v4: uuidv4 } = require('uuid');
const db = require('../database');

let SerialPort;
try {
  SerialPort = require('serialport').SerialPort;
} catch (e) {
  console.error("The 'serialport' module failed to load. SMS functionality will be disabled. Error:", e.message);
  SerialPort = null;
}

let smsQueue = [];
let isProcessingSms = false;
let mainWindow;
const MAX_SMS_RETRIES = 3;
let smsSettings = { port: null, baudRate: 9600 }; // Default baud rate

async function queueSmsForSending(message) {
    try {
        const fullMessage = {
            id: uuidv4(),
            ...message,
            status: 'PENDING',
            attempts: 0,
            createdAt: new Date().toISOString(),
        };
        db.insert('sms_log', fullMessage);
        smsQueue.push(fullMessage);
        processSmsQueue(); // Trigger queue processing if not already running
        if (mainWindow) mainWindow.webContents.send('database-updated');
        return { success: true, message: 'تمت إضافة الرسالة إلى قائمة الانتظار.' };
    } catch (error) {
        console.error('[SMS] Error queuing message:', error);
        return { success: false, message: `فشل في إرسال الرسالة: ${error.message}` };
    }
}

const loadSmsSettings = () => {
    try {
        const portSetting = db.getSettings('smsComPort');
        if (portSetting && portSetting.value) {
            try {
                // First try to parse as JSON for new/correctly saved data
                smsSettings.port = JSON.parse(portSetting.value);
            } catch (e) {
                // Fallback for old data that was saved as a raw string
                console.warn('[SMS Settings] Could not parse port as JSON, assuming raw string:', portSetting.value);
                smsSettings.port = portSetting.value;
            }
        }
        const baudRateSetting = db.getSettings('smsBaudRate');
        if (baudRateSetting && baudRateSetting.value) {
            try {
                smsSettings.baudRate = JSON.parse(baudRateSetting.value);
            } catch (e) {
                console.warn('[SMS Settings] Could not parse baud rate as JSON, assuming raw number:', baudRateSetting.value);
                const parsedRate = Number(baudRateSetting.value);
                smsSettings.baudRate = isNaN(parsedRate) ? 9600 : parsedRate; // Fallback to default if parsing fails
            }
        }
        console.log('[SMS Settings] Loaded:', smsSettings);
    } catch (e) {
        console.error('[SMS Settings] Failed to load settings:', e);
    }
};

function sendSmsWithModem(phoneNumber, text, portPath, baudRate) {
    return new Promise((resolve, reject) => {
        if (!SerialPort) {
            return reject(new Error("وحدة المنفذ التسلسلي (serialport) غير متوفرة."));
        }
        if (!portPath) {
            return reject(new Error("منفذ مودم الرسائل غير محدد في الإعدادات."));
        }

        const port = new SerialPort({ path: portPath, baudRate: baudRate });
        let step = 0;
        let timeout;
        let buffer = '';

        const cleanup = (err) => {
            clearTimeout(timeout);
            if (port && port.isOpen) {
                port.close((closeErr) => {
                    if (closeErr) console.error(`[SMS Modem] Error closing port: ${closeErr.message}`);
                });
            }
            if (err) reject(err);
        };
        
        timeout = setTimeout(() => {
            cleanup(new Error("لم يستجب المودم في الوقت المناسب (15 ثانية)."));
        }, 15000);

        port.on('open', () => {
            console.log(`[SMS Modem] Port ${portPath} opened for sending SMS.`);
            port.write('AT+CMGF=1\r');
            step = 1;
        });

        port.on('data', (data) => {
            buffer += data.toString();
            // Process lines separated by \r\n
            while (buffer.includes('\r\n')) {
                const lineEnd = buffer.indexOf('\r\n');
                const line = buffer.substring(0, lineEnd).trim();
                buffer = buffer.substring(lineEnd + 2);

                if (line === '') continue;

                console.log(`[SMS Modem] <-- ${line}`);
                if (line.toUpperCase().includes('ERROR')) {
                    cleanup(new Error(`خطأ من المودم: ${line}`));
                    return;
                }

                if (step === 1 && line.toUpperCase().includes('OK')) {
                    console.log(`[SMS Modem] --> Sending to ${phoneNumber}`);
                    port.write(`AT+CMGS="${phoneNumber}"\r`);
                    step = 2;
                    return;
                }

                if (step === 3 && line.toUpperCase().includes('OK')) {
                    cleanup();
                    resolve("SMS sent successfully.");
                    return;
                }
            }
            
            // The '>' prompt might not have a newline
            if (step === 2 && buffer.trim().endsWith('>')) {
                 console.log(`[SMS Modem] <-- > (Prompt received)`);
                 console.log(`[SMS Modem] --> Sending message text...`);
                 buffer = ''; // Clear buffer
                 port.write(`${text}\x1A`); // Message text + CTRL+Z
                 step = 3;
            }
        });

        port.on('error', (err) => {
            cleanup(new Error(`خطأ في المنفذ التسلسلي: ${err.message}`));
        });

        port.on('close', () => {
             console.log(`[SMS Modem] Port ${portPath} closed.`);
        });
    });
}


const sortSmsQueue = () => {
    const priorityValue = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
    smsQueue.sort((a, b) => (priorityValue[b.priority] || 0) - (priorityValue[a.priority] || 0));
};

const processSmsQueue = async () => {
    if (isProcessingSms || smsQueue.length === 0) {
        return;
    }
    isProcessingSms = true;

    sortSmsQueue();
    const message = smsQueue.shift();

    try {
        await sendSmsWithModem(
            message.recipientPhone,
            message.text,
            smsSettings.port,
            smsSettings.baudRate
        );
        
        // --- SUCCESS ---
        db.update('sms_log', message.id, { status: 'SENT' });
        console.log(`[SMS] Sent successfully to ${message.recipientPhone}`);
        if (mainWindow) mainWindow.webContents.send('database-updated');

    } catch (error) {
        // --- FAILURE ---
        console.error(`[SMS] Failed to send to ${message.recipientPhone}. Attempt ${message.attempts + 1}. Error: ${error.message}`);
        message.attempts += 1;
        
        if (message.attempts >= MAX_SMS_RETRIES) {
            db.update('sms_log', message.id, { status: 'FAILED', lastError: error.message });
            if (mainWindow) mainWindow.webContents.send('database-updated');
        } else {
            db.update('sms_log', message.id, { status: 'RETRYING', lastError: error.message, attempts: message.attempts });
            // Re-queue for retry
            setTimeout(() => {
                smsQueue.push(message);
            }, 5000 * message.attempts);
            if (mainWindow) mainWindow.webContents.send('database-updated');
        }
    } finally {
        // Throttle
        setTimeout(() => {
            isProcessingSms = false;
            processSmsQueue();
        }, 3000);
    }
};

const startQueueProcessor = (win) => {
    mainWindow = win;
    processSmsQueue();
};

module.exports = {
    loadSmsSettings,
    queueSmsForSending,
    startQueueProcessor
};
