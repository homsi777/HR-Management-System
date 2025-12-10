
/**
 * @typedef {import('../types').Device} Device
 * @typedef {import('../types').Employee} Employee
 */

// Mock implementation for ZKTeco device interactions.
// In a real application, this would use a library like 'node-zklib'
// to communicate with the hardware over TCP/IP.
// This file is written in plain JavaScript (CommonJS) to be directly consumable by main.js.

const mockDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * @param {Device} device
 * @returns {Promise<{success: boolean, message: string}>}
 */
const testConnection = async (device) => {
    console.log(`[Mock ZK] Testing connection to ${device.ip}:${device.port}...`);
    await mockDelay(1500);
    // Simulate a 20% chance of failure
    if (Math.random() > 0.8) {
        console.log(`[Mock ZK] Connection failed.`);
        return { success: false, message: `فشل الاتصال بالجهاز ${device.ip}` };
    }
    console.log(`[Mock ZK] Connection successful.`);
    return { success: true, message: `تم الاتصال بالجهاز ${device.ip} بنجاح` };
};

/**
 * @param {Device} device
 * @returns {Promise<Array<{employeeId: number, date: string, checkIn: string, checkOut: string}>>}
 */
const syncAttendance = async (device) => {
    console.log(`[Mock ZK] Syncing attendance from ${device.ip}...`);
    await mockDelay(3000);
    
    // Generate 5 to 20 mock attendance records
    const records = [];
    const numRecords = Math.floor(Math.random() * 16) + 5;
    const today = new Date();
    
    for (let i = 0; i < numRecords; i++) {
        const employeeId = Math.floor(Math.random() * 10) + 1; // Mock employee IDs 1-10
        const checkInHour = 8 + Math.floor(Math.random() * 2); // 08:xx or 09:xx
        const checkInMinute = Math.floor(Math.random() * 60);
        const checkOutHour = 17 + Math.floor(Math.random() * 2); // 17:xx or 18:xx
        const checkOutMinute = Math.floor(Math.random() * 60);

        records.push({
            employeeId: employeeId,
            date: today.toISOString().split('T')[0],
            checkIn: `${String(checkInHour).padStart(2, '0')}:${String(checkInMinute).padStart(2, '0')}`,
            checkOut: `${String(checkOutHour).padStart(2, '0')}:${String(checkOutMinute).padStart(2, '0')}`,
        });
    }
    
    console.log(`[Mock ZK] Synced ${records.length} records.`);
    return records;
};

/**
 * @param {Device} device
 * @param {Employee[]} employees
 * @returns {Promise<{success: boolean, message: string}>}
 */
const uploadUsers = async (device, employees) => {
    console.log(`[Mock ZK] Uploading ${employees.length} users to ${device.ip}...`);
    // Simulate clearing existing users and uploading new ones
    console.log(`[Mock ZK] Clearing users from device...`);
    await mockDelay(1000);
    console.log(`[Mock ZK] Uploading new user list...`);
    await mockDelay(200 * employees.length); // 200ms per employee
    
    console.log(`[Mock ZK] Upload complete.`);
    return { success: true, message: `تم رفع بيانات ${employees.length} موظف بنجاح.` };
};

module.exports = {
    testConnection,
    syncAttendance,
    uploadUsers
};
