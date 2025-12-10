const { ipcMain } = require('electron');
let SerialPort;
try {
  SerialPort = require('serialport').SerialPort;
} catch (e) {
  console.error("The 'serialport' module failed to load. Scanner functionality will be disabled. Error:", e.message);
  SerialPort = null;
}

let iconv;
try {
    iconv = require('iconv-lite');
} catch (e) {
    console.error("The 'iconv-lite' module failed to load. Barcode decoding may not work correctly. Error:", e.message);
    iconv = null;
}

let scannerPort = null;
let mainWindow;

function initialize(win) {
    mainWindow = win;
}

function cleanup() {
    if (scannerPort && scannerPort.isOpen) {
        scannerPort.close((err) => {
            if (err) console.error('[Scanner] Error closing port on cleanup:', err.message);
            else console.log('[Scanner] Scanner port closed on cleanup.');
        });
    }
    scannerPort = null;
}

function startListener(port, baudRate) {
    cleanup(); // Ensure any existing listener is stopped

    if (!port) {
        console.error("[Scanner] Listener not started: Port is not specified.");
        if (mainWindow) mainWindow.webContents.send('scanner:error', { message: 'لم يتم تحديد منفذ COM للماسح الضوئي.' });
        return;
    }

    scannerPort = new SerialPort({ path: port, baudRate: parseInt(baudRate, 10) });

    scannerPort.on('open', () => console.log(`[Scanner] Port ${port} opened successfully.`));
    
    scannerPort.on('data', (dataBuffer) => {
        try {
            // Decode from Windows-1256 for Syrian ID cards
            const decodedText = iconv.decode(dataBuffer, 'cp1256');
            
            // Parse the text into structured data
            const cleaned = decodedText.replace(/[\r\n\x00-\x1F\x7F-\x9F]/g, "").trim();
            const parts = cleaned.split('#').map(p => p.trim());

            if (parts.length < 6) {
                console.warn(`[Scanner] Incomplete ID data received. Found ${parts.length} parts.`);
            }

            const parsedData = {
                given_name: parts[0] || '',
                family_name: parts[1] || '',
                father_name: parts[2] || '',
                mother_name: parts[3] || '',
                birth_info: parts[4] || '',
                national_id: parts[5] || '',
                full_name: [parts[0], parts[2], parts[1]].filter(Boolean).join(' ').trim(),
                raw: decodedText,
            };
            
            if (mainWindow) {
                mainWindow.webContents.send('scanner:data', parsedData);
            }
        } catch (error) {
            console.error('[Scanner] Error processing scanned data:', error);
             if (mainWindow) {
                mainWindow.webContents.send('scanner:error', { message: 'خطأ في معالجة البيانات الممسوحة.' });
            }
        }
    });

    scannerPort.on('error', (err) => {
        console.error('[Scanner] SerialPort Error:', err.message);
        if (mainWindow) {
            mainWindow.webContents.send('scanner:error', { message: `خطأ في الماسح الضوئي: ${err.message}` });
        }
        cleanup();
    });
    scannerPort.on('close', () => console.log('[Scanner] Port closed.'));
}

async function listPorts() {
    if (!SerialPort) {
        return [];
    }
    try {
        const ports = await SerialPort.list();
        return ports.map(p => ({ path: p.path }));
    } catch (error) {
        console.error('[Scanner] Failed to list serial ports:', error);
        if (mainWindow) mainWindow.webContents.send('scanner:error', { message: `فشل في جلب قائمة المنافذ: ${error.message}` });
        return [];
    }
}

function checkDependencies() {
    if (!SerialPort || !iconv) {
        console.warn("[Scanner] Scanner functionality is disabled because 'serialport' or 'iconv-lite' failed to load.");
        const errorMessage = "فشل تحميل وحدة الماسح الضوئي. قد تكون الوحدة غير مثبتة بشكل صحيح.";
        if (mainWindow) mainWindow.webContents.send('scanner:error', { message: errorMessage });
        return false;
    }
    return true;
}

module.exports = {
    initialize,
    cleanup,
    startListener,
    listPorts,
    checkDependencies
};
