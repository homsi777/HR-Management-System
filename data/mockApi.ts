
import type { User, ServiceStatus, ToastState, ScannedIDData, LeaveStatus, PayrollCalculationResult, LicenseType } from '../types';

// This mock API provides a fallback for browser-based development,
// allowing the UI to be tested without a live Electron backend.

// In-memory store for our mock database has been cleared of mock data.
const mockDatabase: { [key: string]: any[] } = {
    employees: [],
    attendance: [],
    leaveRequests: [],
    salaryAdvances: [],
    devices: [],
    branches: [],
    departments: [],
    jobTitles: [],
    users: [],
    representatives: [],
    transfers: [],
    custody: [],
    unmatched_attendance: [],
    settings: []
};


const mockApi = {
    db: {
        getAll: async (table: string) => {
            console.log(`[Mock API] getAll for ${table}`);
            // Return a deep copy to prevent direct state mutation
            return JSON.parse(JSON.stringify(mockDatabase[table] || []));
        },
        getById: async (table: string, id: number) => {
            const tableData = mockDatabase[table] || [];
            const item = tableData.find(i => i.id === id);
            console.log(`[Mock API] getById for ${table}, id ${id}:`, item);
            return item ? JSON.parse(JSON.stringify(item)) : null;
        },
        insert: async (table: string, data: any) => {
            if (!mockDatabase[table]) {
                mockDatabase[table] = [];
            }
            const newId = (mockDatabase[table].length > 0) ? Math.max(...mockDatabase[table].map(i => i.id)) + 1 : 1;
            const newItem = { ...data, id: newId };
            mockDatabase[table].push(newItem);
            console.log(`[Mock API] insert into ${table}:`, newItem);
            return JSON.parse(JSON.stringify(newItem));
        },
        update: async (table: string, id: number, data: any) => {
            const tableData = mockDatabase[table] || [];
            const itemIndex = tableData.findIndex(i => i.id === id);
            if (itemIndex > -1) {
                mockDatabase[table][itemIndex] = { ...tableData[itemIndex], ...data };
                console.log(`[Mock API] update in ${table}, id ${id}:`, mockDatabase[table][itemIndex]);
                return 1; // Number of rows changed
            }
            return 0;
        },
        delete: async (table: string, id: number) => {
            const initialLength = mockDatabase[table]?.length || 0;
            mockDatabase[table] = (mockDatabase[table] || []).filter(i => i.id !== id);
            const changed = initialLength - (mockDatabase[table]?.length || 0);
            console.log(`[Mock API] delete from ${table}, id ${id}, changed: ${changed}`);
            return changed;
        },
        getSettings: async (key: string) => {
            const setting = mockDatabase.settings.find(s => s.key === key);
            console.log(`[Mock API] getSettings for ${key}:`, setting);
            return setting ? JSON.parse(JSON.stringify(setting)) : null;
        },
        updateSettings: async (key: string, value: any) => {
            const settingIndex = mockDatabase.settings.findIndex(s => s.key === key);
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            if (settingIndex > -1) {
                mockDatabase.settings[settingIndex].value = stringValue;
            } else {
                mockDatabase.settings.push({ key, value: stringValue });
            }
            console.log(`[Mock API] updateSettings for ${key}:`, value);
            return 1;
        },
        clearAllData: async (confirmationText: string) => {
            if (confirmationText !== 'مسح') {
                return { success: false, message: 'النص التأكيدي غير صحيح (mock).' };
            }
            console.log(`[Mock API] clearAllData called. In a real mock, the database would be reset here.`);
            // For this mock, we'll just return success without actually resetting the complex initial state.
            return { success: true, message: 'تم مسح البيانات بنجاح (mock).' };
        },
        export: async () => {
            console.log('[Mock API] export database called.');
            return { success: true, message: 'تم تصدير قاعدة البيانات بنجاح (محاكاة).' };
        },
        import: async (filePath: string) => {
            console.log(`[Mock API] import database from ${filePath} called.`);
            return { success: true, message: 'تم استيراد قاعدة البيانات بنجاح (محاكاة). سيتم إعادة تحميل التطبيق.' };
        },
    },
    auth: {
        login: async (username: string, password: string): Promise<{ success: boolean; message: string; user: User | null }> => {
            console.log(`[Mock API] login attempt for user: ${username}`);
            // With mock data removed, this will always fail unless data is manually inserted.
            const user = mockDatabase.users.find(u => u.username === username);

            if (user && user.password === password) {
                 const { password: _, ...userWithoutPassword } = user;
                return { success: true, message: 'Login successful (mock)', user: userWithoutPassword as User };
            }
            return { success: false, message: 'Invalid credentials (mock)', user: null };
        },
    },
    device: {
        testConnection: async (device: any) => {
            console.log(`[Mock API] testConnection:`, device);
            return { success: true, message: 'Device connection successful (mock)' };
        },
        syncAttendance: async (device: any) => {
            console.log(`[Mock API] syncAttendance:`, device);
            return { success: true, message: 'Device sync successful (mock)' };
        },
        syncAttendanceNode: async (device: any) => {
            console.log(`[Mock API] syncAttendanceNode:`, device);
            return { success: true, message: 'Node sync successful (mock)' };
        },
        uploadUsers: async (device: any) => {
            console.log(`[Mock API] uploadUsers:`, device);
            return { success: true, message: 'User upload successful (mock)' };
        },
        runPythonScript: async () => {
            console.log(`[Mock API] runPythonScript called.`);
            return { success: true, message: 'Script executed (Mock).' };
        },
    },
    app: {
        verifyActivationCode: async (payload: { code: string, type: LicenseType }) => {
            console.log(`[Mock API] verifyActivationCode: ${payload.code} (Type: ${payload.type})`);
            return { success: true, message: 'Activation successful (mock)' };
        },
        getActivationCodes: async () => {
            return { success: true, data: [{governorate: 'Damascus', type: 'Full', code: 'DAMF300001'}] };
        },
        resolveUnmatchedRecord: async ({ unmatchedId, employeeId }) => {
            console.log(`[Mock API] resolveUnmatchedRecord: unmatchedId ${unmatchedId}, employeeId ${employeeId}`);
            // Mock the logic: find unmatched, update employee, create attendance, delete unmatched
            const unmatchedIndex = mockDatabase.unmatched_attendance.findIndex(r => r.id === unmatchedId);
            if (unmatchedIndex === -1) return { success: false, message: "Unmatched record not found (mock)" };
            
            const unmatchedRecord = mockDatabase.unmatched_attendance[unmatchedIndex];
            
            const employeeIndex = mockDatabase.employees.findIndex(e => e.id === employeeId);
            if (employeeIndex === -1) return { success: false, message: "Employee not found (mock)" };
            
            mockDatabase.employees[employeeIndex].biometricId = unmatchedRecord.biometricId;
            mockDatabase.unmatched_attendance.splice(unmatchedIndex, 1);

            return { success: true, message: "Record resolved successfully (mock)" };
        },
        onDatabaseUpdate: (callback: () => void) => {
            console.log('[Mock API] onDatabaseUpdate listener registered.');
            // Return a dummy cleanup function for browser development
            return () => {
                console.log('[Mock API] onDatabaseUpdate listener cleaned up.');
            };
        },
        onSystemEvent: (callback: (event: { type: ToastState['type']; message: string }) => void) => {
            console.log('[Mock API] onSystemEvent listener registered.');
            return () => {
                console.log('[Mock API] onSystemEvent listener cleaned up.');
            };
        },
        onSystemStatusUpdate: (callback: (status: ServiceStatus) => void) => {
            console.log('[Mock API] onSystemStatusUpdate listener registered.');
            // Optionally send a mock status update
            setTimeout(() => callback({
                apiServer: { status: 'listening', activity: 'idle', port: 3001, error: null },
                pushService: { status: 'listening', activity: 'idle', port: 5005, error: null }
            }), 2000);
            return () => {
                console.log('[Mock API] onSystemStatusUpdate listener cleaned up.');
            };
        },
        showOpenDialog: async () => {
            console.log(`[Mock API] showOpenDialog called.`);
            // In a browser, we can't really open a native file dialog and get a path,
            // so we just simulate cancellation.
            return { canceled: true };
        },
        print: async (options: { content?: string; printOptions?: any }) => {
            console.log('[Mock API] Print requested with options:', options);
            // Simulate a successful print
            return Promise.resolve();
        },
        terminateEmployee: async (payload: { employeeId: number; terminationDate: string; reason: string; notes?: string; }) => {
            console.log(`[Mock API] terminateEmployee:`, payload);
            const employeeIndex = mockDatabase.employees.findIndex(e => e.id === payload.employeeId);
            if (employeeIndex > -1) {
                mockDatabase.employees[employeeIndex].status = 'inactive';
                if (!mockDatabase['terminations']) {
                    mockDatabase['terminations'] = [];
                }
                const newId = (mockDatabase['terminations']?.length > 0) ? Math.max(...mockDatabase['terminations'].map(i => i.id)) + 1 : 1;
                (mockDatabase['terminations'] as any[]).push({ id: newId, ...payload });
                return { success: true, message: 'Employee terminated successfully (mock)' };
            }
            return { success: false, message: 'Employee not found (mock)' };
        },
        onFileDetected: (callback: (filename: string) => void) => {
            console.log('[Mock API] onFileDetected listener registered.');
            return () => {
                console.log('[Mock API] onFileDetected listener cleaned up.');
            };
        },
        processImportFile: async (filename: string) => {
            console.log(`[Mock API] processImportFile called for ${filename}`);
            return { success: true, message: 'File processed successfully (mock)' };
        },
        createVisitorQueue: async (visitorName: string) => {
            console.log(`[Mock API] createVisitorQueue: ${visitorName}`);
            const now = new Date();
            return {
                success: true,
                message: 'تم حجز الدور بنجاح (Mock)',
                data: {
                    id: Date.now(),
                    visitorName,
                    queueNumber: 1,
                    date: now.toISOString().split('T')[0],
                    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
                }
            };
        },
        launchTool: async (toolName: 'zk_pro' | 'timy') => {
            console.log(`[Mock API] launchTool: ${toolName}`);
            return { success: true, message: `تم تشغيل الأداة ${toolName} (محاكاة)` };
        },
        syncToCloud: async () => {
            console.log('[Mock API] syncToCloud called');
            return { success: true, message: 'تمت المزامنة بنجاح (محاكاة)', count: 5 };
        },
        downloadFromCloud: async () => {
            console.log('[Mock API] downloadFromCloud called');
            return { success: true, message: 'تم جلب 3 سجلات من السحابة (محاكاة)', count: 3 };
        }
    },
    payroll: {
        deliverSalary: async ({ employeeId, year, month }) => {
            console.log(`[Mock API] deliverSalary for employee ${employeeId}, period ${year}-${month}`);
            const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
            
            mockDatabase.attendance.forEach(att => {
                if (att.employeeId === employeeId && att.date.startsWith(yearMonth) && !att.isPaid) {
                    att.isPaid = true;
                }
            });

            mockDatabase.salaryAdvances.forEach(adv => {
                if (adv.employeeId === employeeId && adv.date.startsWith(yearMonth) && adv.status === 'Approved') {
                    adv.status = 'Paid';
                }
            });

            return { success: true, message: 'Salary delivered successfully (mock)' };
        },
        calculate: async ({ employeeId, startDate, endDate }): Promise<PayrollCalculationResult> => {
            console.log(`[Mock API] calculate payroll for employee ${employeeId} from ${startDate} to ${endDate}`);
            // Return a dummy result that matches PayrollCalculationResult
            return {
                baseSalary: 1000,
                overtimePay: 100,
                bonusesTotal: 50,
                latenessDeductions: 10,
                unpaidLeaveDeductions: 0,
                manualDeductionsTotal: 5,
                advancesTotal: 200,
                totalDeductions: 215,
                netSalary: 935,
                totalWorkedHours: 160,
                totalRegularHours: 155,
                totalOvertimeHours: 5,
                totalLateMinutes: 30,
            };
        }
    },
    leave: {
        updateStatus: async (payload: { requestId: number; newStatus: LeaveStatus; reason: string; }) => {
            console.log(`[Mock API] update leave status:`, payload);
            const { requestId, newStatus, reason } = payload;
            const itemIndex = (mockDatabase.leaveRequests || []).findIndex(i => i.id === requestId);
            if (itemIndex > -1) {
                mockDatabase.leaveRequests[itemIndex].status = newStatus;
                (mockDatabase.leaveRequests[itemIndex] as any).statusReason = reason;
                return { success: true, message: 'Leave status updated (mock)' };
            }
            return { success: false, message: 'Leave request not found (mock)' };
        },
    },
    scanner: {
        listPorts: async () => { 
            console.log('[Mock API] listPorts');
            return [{ path: 'COM1' }, { path: 'COM3' }]; // Return mock ports
        },
        startListener: (config) => { 
            console.log('[Mock API] startListener with config:', config);
            // Simulate a scan after a delay
            setTimeout(() => {
                const mockData: ScannedIDData = {
                    given_name: 'عبدالله',
                    family_name: 'الأحمد',
                    father_name: 'محمد',
                    mother_name: 'فاطمة',
                    birth_info: '01-01-1990-دمشق',
                    national_id: '01020304050',
                    full_name: 'عبدالله محمد الأحمد',
                    raw: 'Mock data string',
                };
                // To call the listener, we need to manage it globally, which is complex for a mock.
                // This mock won't actually trigger the onScanData callback.
            }, 3000);
        },
        stopListener: () => { console.log('[Mock API] stopListener'); },
        onScanData: (callback) => { console.log('[Mock API] onScanData listener registered.'); },
        onScanError: (callback) => { console.log('[Mock API] onScanError listener registered.'); },
        removeListeners: () => { console.log('[Mock API] removeListeners called.'); }
    },
    sms: {
        send: async (message: any) => {
            console.log('[Mock API] send SMS:', message);
            return { success: true, message: 'SMS sent successfully (mock).' };
        },
        getLog: async () => {
            console.log('[Mock API] get SMS log');
            return []; // Return empty array for mock
        },
    }
};

export default mockApi;
