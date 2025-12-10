
const ZKLib = require('zklib-js-zkteko');

/**
 * Connects to a ZK device and fetches attendance logs using zklib-js-zkteko.
 * Uses retry logic to handle unstable UDP connections.
 * @param {import('../types').Device} device - Device configuration { ip, port, ... }
 * @returns {Promise<{success: boolean, message: string, data: Array}>}
 */
async function syncAttendanceNode(device) {
    const ip = device.ip;
    const port = device.port || 4370;
    
    console.log(`[ZK Node] Starting sync process for ${ip}:${port}...`);

    let attempts = 0;
    const maxAttempts = 3;
    let lastError = null;

    while (attempts < maxAttempts) {
        attempts++;
        console.log(`[ZK Node] Connection attempt ${attempts}/${maxAttempts} to ${ip}...`);
        
        // Create instance with generous timeouts
        const zk = new ZKLib(ip, port, 10000, 4000);

        try {
            await zk.createSocket();
            console.log(`[ZK Node] Socket created.`);

            // Get logs
            let logs = await zk.getAttendances();
            
            // Debug log to see what we actually got
            console.log(`[ZK Node] Raw logs type: ${typeof logs}, isArray: ${Array.isArray(logs)}`);
            if (logs && typeof logs === 'object' && !Array.isArray(logs)) {
                console.log(`[ZK Node] Logs structure sample keys: ${Object.keys(logs).join(', ')}`);
            }

            // Handle case where logs might be wrapped in an object { data: [...] }
            if (logs && !Array.isArray(logs) && logs.data && Array.isArray(logs.data)) {
                console.log(`[ZK Node] Detected wrapped logs in .data property.`);
                logs = logs.data;
            }

            // Validate result
            if (!Array.isArray(logs)) {
                // If logs is undefined/null but connection was okay, it might mean empty, or failure.
                // Usually empty logs return []
                console.warn(`[ZK Node] Invalid logs received (not an array). Retrying...`);
                throw new Error("Received invalid logs format from device");
            }

            console.log(`[ZK Node] Successfully fetched ${logs.length} raw logs.`);
            
            // Graceful disconnect
            try { await zk.disconnect(); } catch (e) { /* ignore disconnect errors */ }

            // Map to standard format AND Filter garbage data
            const formattedLogs = logs
                .map(log => {
                    let timeStr = log.recordTime;
                    // Some libraries return Date object, some return string
                    if (log.recordTime instanceof Date) {
                        const d = log.recordTime;
                        const pad = (n) => String(n).padStart(2, '0');
                        timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                    }
                    return {
                        user_id: log.deviceUserId,
                        timestamp: timeStr
                    };
                })
                .filter(log => {
                    // Filter out records with ID 0 (usually system/empty)
                    if (!log.user_id || log.user_id == 0) return false;
                    
                    // Filter out default dates (year 2000 or earlier usually indicates unset clock)
                    // You can adjust this year check if needed
                    if (log.timestamp && (log.timestamp.startsWith('2000') || log.timestamp.startsWith('1970'))) {
                        return false;
                    }
                    return true;
                });

            console.log(`[ZK Node] Valid records after filtering: ${formattedLogs.length}`);

            return {
                success: true,
                message: `تم الاتصال وجلب ${formattedLogs.length} سجل صالح بنجاح.`,
                data: formattedLogs
            };

        } catch (error) {
            console.error(`[ZK Node] Error on attempt ${attempts}:`, error.message);
            lastError = error;
            
            // Ensure cleanup before retry
            try { await zk.disconnect(); } catch (e) {}

            // If it's the last attempt, fail
            if (attempts >= maxAttempts) {
                break;
            }
            
            // Wait 2 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // If we get here, all attempts failed
    let userMsg = `فشل الاتصال بالجهاز ${ip} بعد ${maxAttempts} محاولات.`;
    if (lastError) {
        if (lastError.code === 'EHOSTUNREACH' || lastError.code === 'ETIMEDOUT') userMsg += ` (الجهاز لا يمكن الوصول إليه)`;
        else if (lastError.code === 'ECONNREFUSED') userMsg += ` (تم رفض الاتصال)`;
        else userMsg += ` (${lastError.message})`;
    }

    return {
        success: false,
        message: userMsg,
        data: []
    };
}

/**
 * Tests connection to a ZK device (Real Connection).
 * @param {import('../types').Device} device - Device configuration
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function testConnectionNode(device) {
    const ip = device.ip;
    const port = device.port || 4370;
    
    console.log(`[ZK Node] Testing REAL connection to ${ip}:${port}...`);

    const zk = new ZKLib(ip, port, 5000, 4000); // 5 sec timeout for test

    try {
        await zk.createSocket();
        const info = await zk.getInfo();
        console.log(`[ZK Node] Connection Successful. Device Info:`, info);

        try { await zk.disconnect(); } catch (e) {}

        return {
            success: true,
            message: `تم الاتصال بنجاح! (${info.deviceName || 'جهاز ZK'} - السجلات: ${info.logCounts})`
        };

    } catch (error) {
        console.error(`[ZK Node] Test Connection Failed:`, error);
        try { await zk.disconnect(); } catch (e) {}
        
        let reason = "الجهاز غير متصل أو الإعدادات خاطئة.";
        if (error.code === 'ETIMEDOUT') reason = "انتهت مهلة الاتصال (الجهاز مطفأ أو الشبكة مفصولة).";
        
        return { 
            success: false, 
            message: `فشل الاتصال: ${reason}` 
        };
    }
}

module.exports = {
    syncAttendanceNode,
    testConnectionNode
};
