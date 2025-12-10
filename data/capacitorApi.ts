
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { JeepSqlite } from 'jeep-sqlite/dist/components/jeep-sqlite';
import type { IElectronAPI, LeaveStatus, ScannedIDData, ServiceStatus, ToastState, User, PayrollCalculationResult, LicenseType } from '../types';

let capacitorApi: IElectronAPI;

// Helper to check if we are in an Electron environment
if (typeof window !== 'undefined' && (window as any).electronAPI) {
    // If Electron is available, we don't use this API implementation.
    // We export a dummy one just to satisfy the compiler if this file is imported.
    capacitorApi = {
        db: {
            getAll: async () => [],
            getById: async () => null,
            insert: async (t, d) => d,
            update: async () => 0,
            delete: async () => 0,
            getSettings: async () => null,
            updateSettings: async () => 0,
            clearAllData: async () => ({ success: false, message: 'Not supported in this context' }),
            export: async () => ({ success: false, message: 'Not supported in this context' }),
            import: async (filePath: string) => ({ success: false, message: 'Not supported in this context' }),
        },
        auth: { login: async () => ({ success: false, message: 'Not supported in this context', user: null }) },
        device: {
            testConnection: async () => ({ success: false, message: 'Not supported in this context' }),
            syncAttendance: async () => ({ success: false, message: 'Not supported in this context' }),
            syncAttendanceNode: async () => ({ success: false, message: 'Not supported in this context' }),
            uploadUsers: async () => ({ success: false, message: 'Not supported in this context' }),
            runPythonScript: async () => ({ success: false, message: 'Not supported in this context' }),
        },
        app: {
            verifyActivationCode: async (payload) => ({ success: false, message: 'Not supported in this context' }),
            getActivationCodes: async () => ({ success: false, data: [] }),
            onDatabaseUpdate: () => () => {},
            resolveUnmatchedRecord: async () => ({ success: false, message: 'Not supported in this context' }),
            onSystemEvent: () => () => {},
            onSystemStatusUpdate: () => () => {},
            showOpenDialog: async () => ({ canceled: true }),
            print: async () => {},
            terminateEmployee: async () => ({ success: false, message: 'Not supported in this context' }),
            onFileDetected: () => () => {},
            processImportFile: async () => ({ success: false, message: 'Not supported in this context' }),
            createVisitorQueue: async () => ({ success: false, message: 'Not supported in this context' }),
            launchTool: async () => ({ success: false, message: 'Not supported in this context' }),
            syncToCloud: async () => ({ success: false, message: 'Not supported in this context' }),
            downloadFromCloud: async () => ({ success: false, message: 'Not supported in this context' }),
        },
        payroll: { 
            deliverSalary: async () => ({ success: false, message: 'Not supported in this context' }),
            calculate: async () => ({
                baseSalary: 0, overtimePay: 0, bonusesTotal: 0, latenessDeductions: 0,
                unpaidLeaveDeductions: 0, manualDeductionsTotal: 0, advancesTotal: 0,
                totalDeductions: 0, netSalary: 0, totalWorkedHours: 0,
                totalRegularHours: 0, totalOvertimeHours: 0, totalLateMinutes: 0
            })
        },
        leave: { updateStatus: async () => ({ success: false, message: 'Not supported in this context' }) },
        scanner: {
            listPorts: async () => [],
            startListener: () => {},
            stopListener: () => {},
            onScanData: () => {},
            onScanError: () => {},
            removeListeners: () => {},
        },
        sms: {
            send: async () => ({ success: false, message: 'Not supported' }),
            getLog: async () => [],
        }
    };
} else {
    // --- ORIGINAL CAPACITOR LOGIC START ---
    
    // Web-specific: define jeep-sqlite element
    if (Capacitor.getPlatform() === 'web') {
        window.customElements.define('jeep-sqlite', JeepSqlite);
    }

    const sqlite = new SQLiteConnection(CapacitorSQLite);
    let db: SQLiteDBConnection;

    const initDb = async () => {
        if (db) return;
        try {
            // Create or open the database
            db = await sqlite.createConnection('hr_db', false, 'no-encryption', 1, false);
            await db.open();

            // Define schema (Simplified version of main.js schema for mobile)
            const schema = `
                CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL, permissions TEXT);
                CREATE TABLE IF NOT EXISTS employees (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, employeeCode TEXT, jobTitleId INTEGER, departmentId INTEGER, branchId INTEGER, hireDate TEXT, status TEXT, phone TEXT, email TEXT, address TEXT, biometricId TEXT, nationalId TEXT, paymentType TEXT DEFAULT 'hourly', monthlySalary REAL DEFAULT 0, weeklySalary REAL DEFAULT 0, agreedDailyHours REAL DEFAULT 8, hourlyRate REAL DEFAULT 0, overtimeRate REAL DEFAULT 0, latenessDeductionRate REAL DEFAULT 0, calculateSalaryBy30Days BOOLEAN DEFAULT 0, assignedDeviceIds TEXT, workdays TEXT, checkInStartTime TEXT, checkInEndTime TEXT, checkOutStartTime TEXT, checkOutEndTime TEXT, photo TEXT, idPhotoFront TEXT, idPhotoBack TEXT, checkInType TEXT, previousJobTitle TEXT, employeeNotes TEXT, salaryCurrency TEXT DEFAULT 'SYP', cvFile TEXT, cvFileName TEXT, cvFileType TEXT, employmentType TEXT DEFAULT 'freelance', contractStartDate TEXT, contractEndDate TEXT, contractFile TEXT, contractFileName TEXT, contractFileType TEXT, source TEXT DEFAULT 'manual');
                CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, employeeId INTEGER NOT NULL, date TEXT NOT NULL, checkIn TEXT NOT NULL, checkOut TEXT, checkOutType TEXT, isPaid BOOLEAN DEFAULT 0, source TEXT);
                CREATE TABLE IF NOT EXISTS leaveRequests (id INTEGER PRIMARY KEY AUTOINCREMENT, employeeId INTEGER NOT NULL, type TEXT NOT NULL, startDate TEXT NOT NULL, endDate TEXT NOT NULL, reason TEXT, status TEXT NOT NULL, statusReason TEXT, deductFromSalary BOOLEAN DEFAULT 0);
                CREATE TABLE IF NOT EXISTS salaryAdvances (id INTEGER PRIMARY KEY AUTOINCREMENT, employeeId INTEGER NOT NULL, amount REAL NOT NULL, currency TEXT DEFAULT 'SYP', date TEXT NOT NULL, reason TEXT, status TEXT NOT NULL, statusReason TEXT);
                CREATE TABLE IF NOT EXISTS bonuses (id INTEGER PRIMARY KEY AUTOINCREMENT, employeeId INTEGER NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL, date TEXT NOT NULL, reason TEXT);
                CREATE TABLE IF NOT EXISTS deductions (id INTEGER PRIMARY KEY AUTOINCREMENT, employeeId INTEGER NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL, date TEXT NOT NULL, reason TEXT);
                CREATE TABLE IF NOT EXISTS branches (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, address TEXT, managerId INTEGER, branchCode TEXT);
                CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, branchId INTEGER NOT NULL, managerId INTEGER);
                CREATE TABLE IF NOT EXISTS jobTitles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, departmentId INTEGER NOT NULL, description TEXT);
                CREATE TABLE IF NOT EXISTS devices (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, ip TEXT NOT NULL, port INTEGER NOT NULL, commKey INTEGER DEFAULT 0, brand TEXT NOT NULL, status TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS representatives (id INTEGER PRIMARY KEY AUTOINCREMENT, employeeId INTEGER NOT NULL UNIQUE, carType TEXT, carPlateNumber TEXT, assignedArea TEXT, notes TEXT);
                CREATE TABLE IF NOT EXISTS maintenance_staff (id INTEGER PRIMARY KEY AUTOINCREMENT, employeeId INTEGER NOT NULL UNIQUE);
                CREATE TABLE IF NOT EXISTS maintenance_records (id INTEGER PRIMARY KEY AUTOINCREMENT, employeeId INTEGER NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL, date TEXT NOT NULL, notes TEXT);
                CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, address TEXT, business_field TEXT, interests TEXT, notes TEXT, rating INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
                CREATE TABLE IF NOT EXISTS client_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, title TEXT NOT NULL, stage INTEGER DEFAULT 1, description TEXT, due_date TEXT, reminder_time TEXT, status TEXT DEFAULT 'pending', created_at TEXT, updated_at TEXT);
                CREATE TABLE IF NOT EXISTS interests (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL UNIQUE);
                CREATE TABLE IF NOT EXISTS jobApplications (id INTEGER PRIMARY KEY AUTOINCREMENT, fullName TEXT NOT NULL, phone TEXT NOT NULL, address TEXT, experiences TEXT, qualifications TEXT, trainingCourses TEXT, availability TEXT NOT NULL, attachments TEXT, notes TEXT, status TEXT NOT NULL, interviewDateTime TEXT, createdEmployeeId INTEGER, dob TEXT, maritalStatus TEXT, photo TEXT, idPhotoFront TEXT, idPhotoBack TEXT);
                CREATE TABLE IF NOT EXISTS sms_log (id TEXT PRIMARY KEY, recipientName TEXT NOT NULL, recipientPhone TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL, priority TEXT NOT NULL, origin TEXT DEFAULT 'MANUAL', attempts INTEGER DEFAULT 0, createdAt TEXT NOT NULL, lastError TEXT, scheduledAt TEXT);
                CREATE TABLE IF NOT EXISTS visitor_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, visitorName TEXT, queueNumber INTEGER NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL);
                
                -- Initial Seed
                INSERT OR IGNORE INTO users (id, username, password, email, role, status) VALUES (1, 'admin', 'admin', 'admin@company.com', 'Admin', 'Active');
            `;
            
            await db.execute(schema);
            
            // Ensure Web Persistence
            if (Capacitor.getPlatform() === 'web') {
                await sqlite.saveToStore('hr_db');
            }
        } catch (err) {
            console.error('Error initializing DB:', err);
        }
    };

    // Helper to parse JSON fields
    const parseRow = (row: any, table: string) => {
        const jsonFields = {
            employees: ['assignedDeviceIds', 'workdays'],
            users: ['permissions'],
            jobApplications: ['experiences', 'attachments'],
            clients: ['interests']
        } as Record<string, string[]>;

        if (jsonFields[table]) {
            jsonFields[table].forEach(field => {
                if (row[field] && typeof row[field] === 'string') {
                    try { row[field] = JSON.parse(row[field]); } catch (e) { /* ignore */ }
                }
            });
        }
        return row;
    };

    // Helper to stringify JSON fields before insert/update
    const prepareData = (data: any, table: string) => {
        const newData = { ...data };
        const jsonFields = {
            employees: ['assignedDeviceIds', 'workdays'],
            users: ['permissions'],
            jobApplications: ['experiences', 'attachments'],
            clients: ['interests']
        } as Record<string, string[]>;

        if (jsonFields[table]) {
            jsonFields[table].forEach(field => {
                if (newData[field] && typeof newData[field] !== 'string') {
                    newData[field] = JSON.stringify(newData[field]);
                }
            });
        }
        // Convert booleans
        for (const key in newData) {
            if (typeof newData[key] === 'boolean') {
                newData[key] = newData[key] ? 1 : 0;
            }
        }
        return newData;
    };


    capacitorApi = {
        db: {
            getAll: async (table) => {
                await initDb();
                const res = await db.query(`SELECT * FROM ${table}`);
                return (res.values || []).map(row => parseRow(row, table));
            },
            getById: async (table, id) => {
                await initDb();
                const res = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
                return res.values && res.values.length > 0 ? parseRow(res.values[0], table) : null;
            },
            insert: async (table, data) => {
                await initDb();
                const prepared = prepareData(data, table);
                const columns = Object.keys(prepared).join(',');
                const placeholders = Object.keys(prepared).map(() => '?').join(',');
                const values = Object.values(prepared);
                const res = await db.run(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, values);
                
                if (Capacitor.getPlatform() === 'web') await sqlite.saveToStore('hr_db');
                
                // Return mock newly created item with ID
                return { ...data, id: (res.changes && res.changes.lastId) ? res.changes.lastId : Date.now() };
            },
            update: async (table, id, data) => {
                await initDb();
                const prepared = prepareData(data, table);
                const sets = Object.keys(prepared).map(key => `${key} = ?`).join(',');
                const values = [...Object.values(prepared), id];
                const res = await db.run(`UPDATE ${table} SET ${sets} WHERE id = ?`, values);
                if (Capacitor.getPlatform() === 'web') await sqlite.saveToStore('hr_db');
                return res.changes?.changes || 0;
            },
            delete: async (table, id) => {
                await initDb();
                const res = await db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
                if (Capacitor.getPlatform() === 'web') await sqlite.saveToStore('hr_db');
                return res.changes?.changes || 0;
            },
            getSettings: async (key) => {
                await initDb();
                const res = await db.query(`SELECT * FROM settings WHERE key = ?`, [key]);
                return res.values && res.values.length > 0 ? res.values[0] : null;
            },
            updateSettings: async (key, value) => {
                await initDb();
                const stringValue = JSON.stringify(value);
                const existing = await db.query(`SELECT * FROM settings WHERE key = ?`, [key]);
                let res;
                if (existing.values && existing.values.length > 0) {
                    res = await db.run('UPDATE settings SET value = ? WHERE key = ?', [stringValue, key]);
                } else {
                    res = await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, stringValue]);
                }
                if (Capacitor.getPlatform() === 'web') await sqlite.saveToStore('hr_db');
                return res.changes?.changes || 0;
            },
            clearAllData: async (confirmationText) => {
                if (confirmationText !== 'مسح') return { success: false, message: 'رمز التأكيد خاطئ' };
                await initDb();
                await db.run('DELETE FROM employees; DELETE FROM attendance; DELETE FROM leaveRequests;'); 
                return { success: true, message: 'تم مسح البيانات (موبايل)' };
            },
            export: async () => ({ success: false, message: 'Not implemented on mobile' }),
            import: async (path) => ({ success: false, message: 'Not implemented on mobile' })
        },
        auth: {
            login: async (username, password) => {
                await initDb();
                const res = await db.query('SELECT * FROM users WHERE username = ?', [username]);
                const user = res.values && res.values.length > 0 ? res.values[0] : null;
                if (user && user.password === password) {
                    return { success: true, message: 'Login successful', user: parseRow(user, 'users') };
                }
                return { success: false, message: 'Invalid credentials', user: null };
            }
        },
        device: {
            testConnection: async () => ({ success: true, message: 'Mock connection success (Mobile)' }),
            syncAttendance: async () => ({ success: true, message: 'Mock sync success (Mobile)' }),
            syncAttendanceNode: async () => ({ success: false, message: 'Node sync not supported on mobile.' }),
            uploadUsers: async () => ({ success: true, message: 'Mock upload success (Mobile)' }),
            runPythonScript: async () => ({ success: false, message: 'Python scripts not supported on mobile.' }),
        },
        app: {
            verifyActivationCode: async (payload) => {
                // Ensure we access properties correctly whether it's an object or just code passed incorrectly
                const code = payload && payload.code ? payload.code : (typeof payload === 'string' ? payload : '');
                
                if (code.startsWith('HR')) return { success: true, message: 'تم التفعيل' };
                return { success: false, message: 'رمز خاطئ' };
            },
            getActivationCodes: async () => ({ success: false, data: [] }),
            onDatabaseUpdate: () => () => {},
            resolveUnmatchedRecord: async () => ({ success: true, message: 'Resolved (Mock)' }),
            onSystemEvent: () => () => {},
            onSystemStatusUpdate: () => () => {},
            showOpenDialog: async () => ({ canceled: true }),
            print: async () => { console.log('Print not supported natively on web/mobile directly'); },
            terminateEmployee: async (payload) => {
                await initDb();
                await db.run('UPDATE employees SET status = ? WHERE id = ?', ['inactive', payload.employeeId]);
                return { success: true, message: 'تم إنهاء الخدمة (موبايل)' };
            },
            onFileDetected: () => () => {},
            processImportFile: async () => ({ success: false, message: 'Not supported on mobile' }),
            createVisitorQueue: async (visitorName) => {
                await initDb();
                const today = new Date().toISOString().split('T')[0];
                const now = new Date();
                const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                
                const res = await db.query('SELECT MAX(queueNumber) as maxNum FROM visitor_queue WHERE date = ?', [today]);
                let queueNumber = 1;
                if (res.values && res.values.length > 0 && res.values[0].maxNum) {
                    queueNumber = res.values[0].maxNum + 1;
                }

                const insertRes = await db.run('INSERT INTO visitor_queue (visitorName, queueNumber, date, time) VALUES (?, ?, ?, ?)', [visitorName, queueNumber, today, time]);
                if (Capacitor.getPlatform() === 'web') await sqlite.saveToStore('hr_db');

                return {
                    success: true,
                    message: 'تم حجز الدور بنجاح',
                    data: {
                        id: (insertRes.changes && insertRes.changes.lastId) ? insertRes.changes.lastId : Date.now(),
                        visitorName,
                        queueNumber,
                        date: today,
                        time
                    }
                };
            },
            launchTool: async () => ({ success: false, message: 'Not supported on mobile' }),
            syncToCloud: async () => ({ success: false, message: 'Not supported on mobile' }),
            downloadFromCloud: async () => ({ success: false, message: 'Not supported on mobile' }),
        },
        payroll: {
            deliverSalary: async () => ({ success: true, message: 'Salary delivered (Mock)' }),
            calculate: async () => ({
                baseSalary: 0, overtimePay: 0, bonusesTotal: 0, latenessDeductions: 0,
                unpaidLeaveDeductions: 0, manualDeductionsTotal: 0, advancesTotal: 0,
                totalDeductions: 0, netSalary: 0, totalWorkedHours: 0,
                totalRegularHours: 0, totalOvertimeHours: 0, totalLateMinutes: 0
            })
        },
        leave: {
            updateStatus: async ({ requestId, newStatus, reason }) => {
                await initDb();
                await db.run('UPDATE leaveRequests SET status = ?, statusReason = ? WHERE id = ?', [newStatus, reason, requestId]);
                return { success: true, message: 'تم تحديث الحالة' };
            }
        },
        scanner: {
            listPorts: async () => [],
            startListener: () => {},
            stopListener: () => {},
            onScanData: () => {},
            onScanError: () => {},
            removeListeners: () => {}
        },
        sms: {
            send: async (msg) => {
                await initDb();
                const id = Date.now().toString();
                await db.run('INSERT INTO sms_log (id, recipientName, recipientPhone, text, status, priority, origin, attempts, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
                    [id, msg.recipientName, msg.recipientPhone, msg.text, 'SENT', msg.priority, msg.origin, 1, new Date().toISOString()]);
                return { success: true, message: 'Message logged (Mobile Mock)' };
            },
            getLog: async () => {
                await initDb();
                const res = await db.query('SELECT * FROM sms_log ORDER BY createdAt DESC');
                return res.values || [];
            }
        }
    };
}

export default capacitorApi;
