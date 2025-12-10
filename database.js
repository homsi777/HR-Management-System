

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Import modularized logic
const { parseJsonFields, stringifyJsonFields } = require('./database_logic/utils');
const createAuthMethods = require('./database_logic/auth');
const createAttendanceMethods = require('./database_logic/attendance');
const createEmployeeMethods = require('./database_logic/employee');
const createPayrollMethods = require('./database_logic/payroll');
const createVisitorMethods = require('./database_logic/visitor');
const createSettingsMethods = require('./database_logic/settings');


let db;

// The getDb function provides safe access to the initialized db instance.
const getDb = () => {
    if (!db || !db.open) {
        throw new Error("Database has not been initialized or is closed. Call initialize() first.");
    }
    return db;
};

/**
 * Adds a column to a table if it doesn't already exist.
 * @param {Database.Database} dbInstance The database instance.
 * @param {string} tableName The name of the table.
 * @param {string} columnName The name of the column to add.
 * @param {string} columnDefinition The full definition of the column (e.g., 'TEXT NOT NULL DEFAULT "hourly"').
 */
function addColumnIfNotExists(dbInstance, tableName, columnName, columnDefinition) {
    try {
        const tableExists = dbInstance.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
        if (!tableExists) {
            console.warn(`[DB Migration] Table ${tableName} does not exist. Skipping column addition.`);
            return;
        }
        const columns = dbInstance.prepare(`PRAGMA table_info(${tableName})`).all();
        if (!columns.some(col => col.name.toLowerCase() === columnName.toLowerCase())) {
            console.log(`[DB Migration] Column ${columnName} not found in ${tableName}. ADDING...`);
            dbInstance.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
            console.log(`[DB Migration] SUCCESS: Added '${columnName}' to '${tableName}'.`);
        }
    } catch (error) {
        console.error(`[DB Migration] FAILED to add column '${columnName}' to table '${tableName}':`, error.message);
    }
}


function _runSchemaAndSeed(dbInstance) {
     const migrations = [
        `CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            role TEXT NOT NULL CHECK(role IN ('Admin', 'Accountant', 'HR Officer', 'Supervisor', 'Employee')),
            status TEXT NOT NULL CHECK(status IN ('Active', 'Suspended')),
            permissions TEXT
        );`,
        `CREATE TABLE IF NOT EXISTS branches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            address TEXT,
            managerId INTEGER,
            branchCode TEXT NOT NULL UNIQUE,
            FOREIGN KEY (managerId) REFERENCES employees(id) ON DELETE SET NULL
        );`,
        `CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            branchId INTEGER NOT NULL,
            managerId INTEGER,
            FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE CASCADE,
            FOREIGN KEY (managerId) REFERENCES employees(id) ON DELETE SET NULL
        );`,
        `CREATE TABLE IF NOT EXISTS jobTitles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            departmentId INTEGER NOT NULL,
            description TEXT,
            FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employeeCode TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            jobTitleId INTEGER NOT NULL,
            departmentId INTEGER NOT NULL,
            branchId INTEGER NOT NULL,
            hireDate TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('active', 'inactive', 'on_leave')),
            phone TEXT,
            email TEXT,
            address TEXT,
            biometricId TEXT,
            nationalId TEXT,
            paymentType TEXT NOT NULL DEFAULT 'hourly',
            monthlySalary REAL NOT NULL DEFAULT 0,
            weeklySalary REAL NOT NULL DEFAULT 0,
            agreedDailyHours REAL NOT NULL DEFAULT 8,
            hourlyRate REAL NOT NULL DEFAULT 0,
            overtimeRate REAL NOT NULL DEFAULT 0,
            latenessDeductionRate REAL NOT NULL DEFAULT 0,
            calculateSalaryBy30Days BOOLEAN DEFAULT 0,
            assignedDeviceIds TEXT,
            workdays TEXT,
            checkInStartTime TEXT,
            checkInEndTime TEXT,
            checkOutStartTime TEXT,
            checkOutEndTime TEXT,
            photo TEXT,
            idPhotoFront TEXT,
            idPhotoBack TEXT,
            checkInType TEXT,
            previousJobTitle TEXT,
            employeeNotes TEXT,
            salaryCurrency TEXT NOT NULL DEFAULT 'SYP',
            cvFile TEXT,
            cvFileName TEXT,
            cvFileType TEXT,
            employmentType TEXT NOT NULL DEFAULT 'freelance',
            contractStartDate TEXT,
            contractEndDate TEXT,
            contractFile TEXT,
            contractFileName TEXT,
            contractFileType TEXT,
            source TEXT NOT NULL DEFAULT 'manual',
            FOREIGN KEY (jobTitleId) REFERENCES jobTitles(id),
            FOREIGN KEY (departmentId) REFERENCES departments(id),
            FOREIGN KEY (branchId) REFERENCES branches(id)
        );`,
        `CREATE TABLE IF NOT EXISTS work_schedule_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employeeId INTEGER NOT NULL,
            hours REAL NOT NULL,
            startDate TEXT NOT NULL,
            FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employeeId INTEGER NOT NULL,
            date TEXT NOT NULL,
            checkIn TEXT NOT NULL,
            checkOut TEXT,
            checkOutType TEXT CHECK(checkOutType IN ('normal', 'مندوب')),
            isPaid BOOLEAN DEFAULT 0,
            source TEXT,
            is_synced_to_cloud BOOLEAN DEFAULT 0,
            FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS leaveRequests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employeeId INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('Annual', 'Sick', 'Emergency', 'Unpaid')),
            startDate TEXT NOT NULL,
            endDate TEXT NOT NULL,
            reason TEXT,
            status TEXT NOT NULL CHECK(status IN ('Pending', 'Approved', 'Rejected')),
            statusReason TEXT,
            deductFromSalary BOOLEAN DEFAULT 0,
            FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS salaryAdvances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employeeId INTEGER NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT 'SYP',
            date TEXT NOT NULL,
            reason TEXT,
            status TEXT NOT NULL CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Paid')),
            statusReason TEXT,
            FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            ip TEXT NOT NULL,
            port INTEGER NOT NULL,
            commKey INTEGER DEFAULT 0,
            brand TEXT NOT NULL CHECK(brand IN ('ZKTeco', 'Other')),
            status TEXT NOT NULL CHECK(status IN ('connected', 'disconnected', 'unknown'))
        );`,
        `CREATE TABLE IF NOT EXISTS representatives (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employeeId INTEGER NOT NULL UNIQUE,
            carType TEXT,
            carPlateNumber TEXT,
            assignedArea TEXT,
            notes TEXT,
            FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS maintenance_staff (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employeeId INTEGER NOT NULL UNIQUE,
            FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS maintenance_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employeeId INTEGER NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL CHECK(currency IN ('SYP', 'USD', 'TRY')),
            date TEXT NOT NULL,
            notes TEXT,
            FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS manufacturing_staff (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employeeId INTEGER NOT NULL UNIQUE,
            flatSalary REAL NOT NULL DEFAULT 0,
            currency TEXT NOT NULL DEFAULT 'SYP',
            period TEXT NOT NULL CHECK(period IN ('Weekly', 'Monthly')),
            tasks TEXT,
            FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS manufacturing_materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL DEFAULT 0,
            currency TEXT NOT NULL DEFAULT 'SYP'
        );`,
        `CREATE TABLE IF NOT EXISTS unmatched_attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            biometricId TEXT NOT NULL,
            date TEXT NOT NULL,
            punches TEXT NOT NULL,
            UNIQUE(biometricId, date)
        );`,
        `CREATE TABLE IF NOT EXISTS transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender TEXT NOT NULL,
            receiver TEXT NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            date TEXT NOT NULL,
            status TEXT NOT NULL,
            notes TEXT
        );`,
        `CREATE TABLE IF NOT EXISTS bonuses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employeeId INTEGER NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            date TEXT NOT NULL,
            reason TEXT,
            FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS deductions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employeeId INTEGER NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            date TEXT NOT NULL,
            reason TEXT,
            FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employeeId INTEGER NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            weekNumber INTEGER,
            paymentType TEXT NOT NULL,
            grossAmount REAL NOT NULL,
            advancesDeducted REAL NOT NULL DEFAULT 0,
            netAmount REAL NOT NULL,
            paymentDate TEXT NOT NULL,
            FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS custody (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employeeId INTEGER NOT NULL,
            items TEXT NOT NULL,
            date TEXT NOT NULL,
            notes TEXT,
            FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS terminations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employeeId INTEGER NOT NULL,
            terminationDate TEXT NOT NULL,
            reason TEXT NOT NULL,
            notes TEXT,
            financialData TEXT,
            FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS leave_work_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            leaveRequestId INTEGER NOT NULL,
            employeeId INTEGER NOT NULL,
            workDate TEXT NOT NULL,
            checkIn TEXT NOT NULL,
            checkOut TEXT NOT NULL,
            durationHours REAL NOT NULL,
            rate REAL NOT NULL,
            currency TEXT NOT NULL,
            totalAmount REAL NOT NULL,
            notes TEXT,
            status TEXT NOT NULL DEFAULT 'Unpaid',
            paymentDate TEXT,
            FOREIGN KEY (leaveRequestId) REFERENCES leaveRequests(id) ON DELETE CASCADE,
            FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            business_field TEXT,
            interests TEXT,
            notes TEXT,
            rating INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        );`,
        `CREATE TABLE IF NOT EXISTS interests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL UNIQUE
        );`,
        `CREATE TABLE IF NOT EXISTS client_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            stage INTEGER DEFAULT 1,
            description TEXT,
            due_date TEXT,
            reminder_time TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS jobApplications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullName TEXT NOT NULL,
            phone TEXT NOT NULL,
            address TEXT,
            experiences TEXT,
            qualifications TEXT,
            trainingCourses TEXT,
            availability TEXT NOT NULL,
            attachments TEXT,
            notes TEXT,
            status TEXT NOT NULL,
            interviewDateTime TEXT,
            createdEmployeeId INTEGER,
            dob TEXT,
            maritalStatus TEXT,
            photo TEXT,
            idPhotoFront TEXT,
            idPhotoBack TEXT
        );`,
         `CREATE TABLE IF NOT EXISTS phone_book_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );`,
        `CREATE TABLE IF NOT EXISTS phone_book_contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            categoryId INTEGER NOT NULL,
            notes TEXT,
            FOREIGN KEY (categoryId) REFERENCES phone_book_categories(id) ON DELETE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS sms_log (
            id TEXT PRIMARY KEY,
            recipientName TEXT,
            recipientPhone TEXT NOT NULL,
            text TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            priority TEXT NOT NULL DEFAULT 'MEDIUM',
            origin TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            createdAt TEXT NOT NULL,
            lastError TEXT,
            scheduledAt TEXT
        );`,
         `CREATE TABLE IF NOT EXISTS visitor_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            visitorName TEXT,
            queueNumber INTEGER NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS blocked_biometric_ids (
            biometric_id TEXT PRIMARY KEY,
            reason TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        );`
    ];
    
    dbInstance.transaction(() => {
        for (const migration of migrations) {
            dbInstance.exec(migration);
        }
    })();
}

/**
 * Runs all necessary schema migrations after the initial schema is created.
 * @param {Database.Database} dbInstance
 */
function runMigrations(dbInstance) {
    console.log('[DB Migration] Running schema migrations...');
    const tablesWithCloudRecord = [
        'employees', 'attendance', 'payments', 'leaveRequests',
        'salaryAdvances', 'bonuses', 'deductions'
    ];

    dbInstance.transaction(() => {
        // Add 'isCloudRecord' to all relevant tables
        for (const table of tablesWithCloudRecord) {
            addColumnIfNotExists(dbInstance, table, 'isCloudRecord', 'INTEGER DEFAULT 0');
        }
        
        // Add production_tasks to manufacturing_staff
        addColumnIfNotExists(dbInstance, 'manufacturing_staff', 'production_tasks', 'TEXT');

        // Migrate existing employees to have a schedule history record if missing
        const employees = dbInstance.prepare('SELECT id, agreedDailyHours, hireDate FROM employees').all();
        if (employees.length > 0) {
            const historyCount = dbInstance.prepare('SELECT COUNT(*) as count FROM work_schedule_history').get().count;
            if (historyCount === 0) {
                console.log('[DB Migration] Seeding initial work schedule history for existing employees...');
                const insertHistory = dbInstance.prepare('INSERT INTO work_schedule_history (employeeId, hours, startDate) VALUES (?, ?, ?)');
                for (const emp of employees) {
                    // Use hireDate as start date, or today if hireDate is invalid
                    const startDate = emp.hireDate || new Date().toISOString().split('T')[0];
                    insertHistory.run(emp.id, emp.agreedDailyHours || 8, startDate);
                }
            }
        }
    })();
    console.log('[DB Migration] Schema migrations complete.');
}

function seedInitialData(dbInstance) {
    try {
        const count = dbInstance.prepare('SELECT COUNT(*) as count FROM users').get().count;
        if (count === 0) {
            console.log('[DB Seeding] No users found, inserting initial admin user and setting up wizard.');
            const hashedPassword = bcrypt.hashSync('admin', 10);
            
            dbInstance.transaction(() => {
                // 1. Create admin user
                dbInstance.prepare(
                    'INSERT INTO users (id, username, password, email, role, status) VALUES (?, ?, ?, ?, ?, ?)'
                ).run(1, 'admin', hashedPassword, 'admin@company.local', 'Admin', 'Active');
                
                // 2. Set setupCompleted to false to trigger the wizard on first launch
                dbInstance.prepare(
                    "INSERT OR REPLACE INTO settings (key, value) VALUES ('setupCompleted', ?)"
                ).run(JSON.stringify(false));
            })();

        } else {
            console.log(`[DB Seeding] Found ${count} existing user(s). Skipping seed.`);
        }
    } catch (error) {
        console.error('[DB Seeding] Error during initial data seed:', error);
    }
}

// Base methods are defined first.
const dbMethods = {
    initialize: (app) => {
        if (db && db.open) {
            console.warn("[DB] Database is already initialized.");
            return;
        }
        
        const dbPath = app.isPackaged 
            ? path.join(app.getPath('userData'), 'database.db') 
            : 'database.db';

        try {
            db = new Database(dbPath);
            db.pragma('journal_mode = WAL');
            db.pragma('foreign_keys = ON');

            console.log(`[DB] Database initialized at: ${dbPath}`);

            // 1. Create schema if tables don't exist
            _runSchemaAndSeed(db);
            
            // 2. Run all schema migrations
            runMigrations(db);
            
            // 3. Seed initial data if necessary
            seedInitialData(db);

        } catch (err) {
            console.error('[DB] Failed to initialize database:', err);
            throw err; // Critical error, should stop app startup
        }
    },
    
    close: () => {
        if (db && db.open) {
            db.close();
            console.log('[DB] Database connection closed.');
        }
    },

    getDb: getDb,

    getAll: (table) => {
        return parseJsonFields(table, getDb().prepare(`SELECT * FROM ${table}`).all());
    },
    getById: (table, id) => {
        const row = getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
        return row ? parseJsonFields(table, [row])[0] : null;
    },
    insert: (table, data) => {
        const stringifiedData = stringifyJsonFields(table, data);
        const columns = Object.keys(stringifiedData).join(', ');
        const placeholders = Object.keys(stringifiedData).map(() => '?').join(', ');
        const values = Object.values(stringifiedData);
        
        const db = getDb();
        
        // Transaction for employee insertion to add initial history
        if (table === 'employees') {
            let result;
            const tx = db.transaction(() => {
                result = db.prepare(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`).run(values);
                const employeeId = result.lastInsertRowid;
                // Add initial schedule history
                const today = new Date().toISOString().split('T')[0];
                const hours = data.agreedDailyHours !== undefined ? data.agreedDailyHours : 8;
                db.prepare('INSERT INTO work_schedule_history (employeeId, hours, startDate) VALUES (?, ?, ?)').run(employeeId, hours, today);
            });
            tx();
            return dbMethods.getById(table, result.lastInsertRowid);
        } else {
            const result = db.prepare(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`).run(values);
            return dbMethods.getById(table, result.lastInsertRowid);
        }
    },
    update: (table, id, data) => {
        const stringifiedData = stringifyJsonFields(table, data);
        const sets = Object.keys(stringifiedData).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(stringifiedData), id];
        
        const db = getDb();

        // Specific logic for updating employees to track schedule changes
        if (table === 'employees' && data.agreedDailyHours !== undefined) {
            const currentEmp = db.prepare('SELECT agreedDailyHours FROM employees WHERE id = ?').get(id);
            // If hours changed, insert history
            if (currentEmp && Number(currentEmp.agreedDailyHours) !== Number(data.agreedDailyHours)) {
                console.log(`[DB] Detected schedule change for employee ${id}. Updating history.`);
                const today = new Date().toISOString().split('T')[0];
                
                // Transaction to update employee and insert history
                const tx = db.transaction(() => {
                    db.prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).run(values);
                    
                    // Insert new history record effective from today. 
                    // Note: We don't "close" the old record because we query based on startDate.
                    // The query logic will pick the latest record where startDate <= targetDate.
                    db.prepare('INSERT INTO work_schedule_history (employeeId, hours, startDate) VALUES (?, ?, ?)').run(id, data.agreedDailyHours, today);
                });
                tx();
                return 1;
            }
        }

        const result = db.prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).run(values);
        return result.changes;
    },
    deleteRow: (table, id) => {
        // Special case for blocked_biometric_ids where the key is a string
        const keyColumn = table === 'blocked_biometric_ids' ? 'biometric_id' : 'id';
        const result = getDb().prepare(`DELETE FROM ${table} WHERE ${keyColumn} = ?`).run(id);
        return result.changes;
    },

    clearAllData: () => {
        const db = getDb();
        try {
            // Disable Foreign Keys
            db.pragma('foreign_keys = OFF');

            const clearTx = db.transaction(() => {
                // 1. Nullify circular references to allow safe deletion even if FKs were somehow ON
                try {
                    db.prepare('UPDATE branches SET managerId = NULL').run();
                    db.prepare('UPDATE departments SET managerId = NULL').run();
                } catch (e) { console.log('Nullable update failed', e); }

                // 2. Get all tables
                const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
                
                // 3. Delete from tables (excluding users)
                for (const table of tables) {
                    if (table.name !== 'users') {
                         db.prepare(`DELETE FROM ${table.name}`).run();
                    }
                }
                
                // 4. Reset sequences
                const seqTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'").get();
                if (seqTable) {
                    db.prepare("DELETE FROM sqlite_sequence").run();
                }

                // 5. Reset admin
                const hashedPassword = bcrypt.hashSync('admin', 10);
                const adminExists = db.prepare('SELECT id FROM users WHERE id = 1').get();
                if (adminExists) {
                    db.prepare('UPDATE users SET password = ?, username = ?, email = ?, role = ?, status = ? WHERE id = 1')
                      .run(hashedPassword, 'admin', 'admin@company.local', 'Admin', 'Active');
                } else {
                    db.prepare('INSERT INTO users (id, username, password, email, role, status) VALUES (1, ?, ?, ?, ?, ?)')
                      .run('admin', hashedPassword, 'admin@company.local', 'Admin', 'Active');
                }
                db.prepare("DELETE FROM users WHERE id != 1").run();
            });

            clearTx();

            db.pragma('foreign_keys = ON');
            return { success: true, message: 'تم مسح جميع البيانات بنجاح.' };
        } catch (error) {
            console.error('Failed to clear all data:', error);
            try { getDb().pragma('foreign_keys = ON'); } catch (e) {}
            return { success: false, message: `فشل مسح البيانات: ${error.message}` };
        }
    },
    importDataFromBackup: (filePath) => {
        const db = getDb();
        
        // IMPORTANT: Temporarily disable Foreign Keys to allow deleting/inserting without constraint order issues
        db.pragma('foreign_keys = OFF');

        try {
            // Attach the backup database file OUTSIDE the transaction.
            db.exec(`ATTACH DATABASE '${filePath.replace(/'/g, "''")}' AS backup_db`);
            console.log('[DB Import] Attached backup database.');
    
            // Start a transaction for the data migration.
            db.transaction(() => {
                // Get all tables from the backup database.
                const tables = db.prepare("SELECT name FROM backup_db.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    
                for (const table of tables) {
                    const tableName = table.name;
                    
                    const mainTableExists = db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name = ?").get(tableName);
                    if (!mainTableExists) {
                        console.warn(`[DB Import] Skipping table '${tableName}' as it does not exist in the current database schema.`);
                        continue;
                    }
    
                    console.log(`[DB Import] Processing table: ${tableName}`);
    
                    const mainCols = db.prepare(`PRAGMA main.table_info(${tableName})`).all().map(c => c.name.toLowerCase());
                    const backupCols = db.prepare(`PRAGMA backup_db.table_info(${tableName})`).all().map(c => c.name.toLowerCase());
    
                    const commonCols = mainCols.filter(col => backupCols.includes(col));
    
                    if (commonCols.length === 0) {
                        console.warn(`[DB Import] No common columns found for table '${tableName}'. Skipping.`);
                        continue;
                    }
                    
                    db.exec(`DELETE FROM main.${tableName}`);
    
                    const colsString = commonCols.join(', ');
                    const insertStmt = `INSERT INTO main.${tableName} (${colsString}) SELECT ${colsString} FROM backup_db.${tableName}`;
                    db.exec(insertStmt);
                    
                    console.log(`[DB Import] Copied data for table '${tableName}'.`);
                }
            })(); // End of transaction
    
            // Detach the backup database AFTER the transaction.
            db.exec('DETACH DATABASE backup_db');
            console.log('[DB Import] Detached backup database.');
    
            // After importing, run migrations again to ensure schema is fully up-to-date
            console.log('[DB Import] Running migrations post-import...');
            runMigrations(getDb());
    
            // Re-enable Foreign Keys
            db.pragma('foreign_keys = ON');

            return { success: true, message: 'تم استيراد النسخة الاحتياطية بنجاح. سيتم إعادة تحميل الواجهة.' };
        } catch (error) {
            console.error('[DB Import] CRITICAL: Import process failed:', error);
            // Ensure the backup is detached even on error.
            try {
                db.exec('DETACH DATABASE backup_db');
                console.log('[DB Import] Detached backup database on error.');
            } catch (detachError) {
                // Ignore if it's already detached or was never attached.
            }
            
            // Re-enable Foreign Keys even if failed
            db.pragma('foreign_keys = ON');

            return { success: false, message: `فشل استيراد النسخة الاحتياطية: ${error.message}` };
        }
    },
};

// Create a context object with only the most basic, non-dependent methods.
// This is to avoid circular dependencies and ReferenceErrors.
const dbContext = {
    getAll: dbMethods.getAll, // Added this missing method to fix the bug
    getById: dbMethods.getById,
    insert: dbMethods.insert,
    update: dbMethods.update,
    deleteRow: dbMethods.deleteRow,
    // Pass a function that can call getSettings from the final object, avoiding TDZ.
    getSettings: (key) => dbMethods.getSettings(key), 
};

// Create method groups by passing the getDb function and the limited context.
const authMethods = createAuthMethods(getDb, { parseJsonFields });
const attendanceMethods = createAttendanceMethods(getDb, dbContext);
const employeeMethods = createEmployeeMethods(getDb);
const payrollMethods = createPayrollMethods(getDb, dbContext);
const visitorMethods = createVisitorMethods(getDb);
const settingsMethods = createSettingsMethods(getDb);

// Combine all methods into the final exported object.
Object.assign(
    dbMethods,
    authMethods,
    attendanceMethods,
    employeeMethods,
    payrollMethods,
    visitorMethods,
    settingsMethods
);

// Add the getter for the raw db instance at the end.
Object.defineProperty(dbMethods, 'db', {
    get: function() { return getDb(); }
});

module.exports = dbMethods;
