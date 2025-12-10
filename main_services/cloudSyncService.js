const db = require('../database');
const { 
    CLOUD_UPLOAD_EMPLOYEES_URL, CLOUD_UPLOAD_ATTENDANCE_URL, CLOUD_UPLOAD_PAYROLL_URL, 
    CLOUD_UPLOAD_LEAVES_URL, CLOUD_UPLOAD_ADVANCES_URL, CLOUD_UPLOAD_BONUSES_URL, CLOUD_UPLOAD_DEDUCTIONS_URL,
    CLOUD_DOWNLOAD_URL 
} = require('./cloudConfig');

// Helper for POST with Auth Headers
async function postData(url, data, headers) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify(data)
    });
    return await response.json();
}

/**
 * Orchestrates the Full Upload Process (All Tables)
 */
async function uploadNewRecords() {
    try {
        const syncKey = db.getSyncKey();

        if (!syncKey) {
            return { success: false, message: 'فشل الإرسال: المزامنة السحابية متاحة فقط للنسخة الكاملة (Full) المفعلة.' };
        }

        const authHeaders = {
            'hr-center-id': syncKey,
            'hr-sync-key': syncKey
        };

        console.log(`[Cloud Sync] Starting Full Upload Sequence for Center: ${syncKey}`);

        // 1. Employees (Must be first)
        const employees = db.getAll('employees');
        if (employees.length > 0) {
            const res = await postData(CLOUD_UPLOAD_EMPLOYEES_URL, { records: employees }, authHeaders);
            if (!res.success) throw new Error(`Employees Sync Failed: ${res.message || res.error}`);
            console.log('[Cloud] Employees synced.');
        }

        // 2. Attendance (only new/unsynced)
        const unsyncedAttendance = db.getUnsyncedRecords();
        if (unsyncedAttendance.length > 0) {
            const res = await postData(CLOUD_UPLOAD_ATTENDANCE_URL, { records: unsyncedAttendance }, authHeaders);
            if (res.success) db.markRecordsAsSynced(unsyncedAttendance.map(r => r.id));
            else throw new Error(`Attendance Sync Failed: ${res.message || res.error}`);
        }
        
        // 3. Payroll and other tables (all records)
        const tablesToSync = [
            { name: 'payments', url: CLOUD_UPLOAD_PAYROLL_URL },
            { name: 'leaveRequests', url: CLOUD_UPLOAD_LEAVES_URL },
            { name: 'salaryAdvances', url: CLOUD_UPLOAD_ADVANCES_URL },
            { name: 'bonuses', url: CLOUD_UPLOAD_BONUSES_URL },
            { name: 'deductions', url: CLOUD_UPLOAD_DEDUCTIONS_URL },
        ];
        
        for (const table of tablesToSync) {
            let records = db.getAll(table.name);
            if (records.length > 0) {
                const res = await postData(table.url, { records }, authHeaders);
                if (!res.success) throw new Error(`${table.name} Sync Failed: ${res.message || res.error}`);
                console.log(`[Cloud] ${table.name} synced.`);
            } else {
                console.log(`[Cloud] ${table.name} skipped (no records).`);
            }
        }

        return { success: true, message: 'تمت مزامنة كافة البيانات بنجاح.' };

    } catch (error) {
        console.error('[Cloud Upload Error]', error);
        return { success: false, message: `خطأ في الرفع: ${error.message}` };
    }
}

/**
 * Orchestrates the Download Process
 */
async function downloadCloudRecords() {
    try {
        const syncKey = db.getSyncKey();
        if (!syncKey) {
            return { success: false, message: 'فشل الجلب: هوية المركز غير محددة. يرجى التفعيل بنسخة Full.' };
        }
        
        const lastSyncSetting = db.getSettings('lastCloudSyncDate');
        const lastSyncDate = lastSyncSetting ? JSON.parse(lastSyncSetting.value) : null;
        
        console.log(`[Cloud Sync] Download starting. Since: ${lastSyncDate}`);

        const response = await fetch(CLOUD_DOWNLOAD_URL, {
            headers: {
                'hr-center-id': syncKey,
                'hr-sync-key': syncKey,
                'since': lastSyncDate || ''
            }
        });

        const json = await response.json();
        if (!json.success) throw new Error(json.message || json.error || 'Download Failed');
        
        const { employees, attendance, payroll, leaves, advances, bonuses, deductions } = json.data;
        const serverTimestamp = json.timestamp;
        let totalImported = 0;

        db.db.transaction(() => {
            const ensureDefault = (table, id, name, extra = {}) => {
                if (!db.getById(table, id)) {
                    db.insert(table, { id, name, ...extra });
                }
            };
            ensureDefault('branches', 1, 'فرع افتراضي', { branchCode: 'DEF-BR' });
            ensureDefault('departments', 1, 'قسم افتراضي', { branchId: 1 });
            ensureDefault('jobTitles', 1, 'مسمى افتراضي', { departmentId: 1 });

            const cloudToLocalEmpIdMap = new Map();
            if (employees && employees.length > 0) {
                employees.forEach(emp => {
                    if (emp.id && emp.hr_local_id) {
                        cloudToLocalEmpIdMap.set(emp.id, emp.hr_local_id);
                    }
                });
            }

            const upsertRecord = (table, localId, data) => {
                if (db.getById(table, localId)) {
                    db.update(table, localId, data);
                } else {
                    data.id = localId;
                    db.insert(table, data);
                }
            };

            if (employees && employees.length > 0) {
                for (const rec of employees) {
                    const localData = {
                        name: rec.name_full,
                        employeeCode: rec.hr_employee_code ? rec.hr_employee_code.split('-').pop() : rec.hr_local_id,
                        biometricId: rec.biometric_id, nationalId: rec.national_id,
                        status: rec.status, paymentType: rec.payment_type,
                        monthlySalary: rec.monthly_salary, weeklySalary: 0, 
                        agreedDailyHours: rec.agreed_daily_hours || 8,
                        hourlyRate: rec.hourly_rate, overtimeRate: rec.overtime_rate, 
                        latenessDeductionRate: 0,
                        salaryCurrency: rec.salary_currency,
                        workdays: rec.workdays ? JSON.parse(rec.workdays) : [],
                        checkInStartTime: rec.check_in_start_time, checkInEndTime: rec.check_in_end_time,
                        checkOutStartTime: rec.check_out_start_time || rec.check_in_end_time, // Fallback
                        checkOutEndTime: rec.check_out_end_time || rec.check_in_end_time, // Fallback
                        jobTitleId: rec.job_title_id || 1,
                        departmentId: rec.department_id || 1,
                        branchId: rec.branch_id || 1,
                        hireDate: rec.created_at ? rec.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
                        phone: rec.phone || '', email: rec.email || '', address: rec.address || '',
                        source: 'cloud', isCloudRecord: 1,
                    };
                    upsertRecord('employees', rec.hr_local_id, localData);
                }
                totalImported += employees.length;
            }

            if (attendance && attendance.length > 0) {
                for (const rec of attendance) {
                    const localEmployeeId = cloudToLocalEmpIdMap.get(rec.employee_id);
                    if (!localEmployeeId) continue;
                    const localData = {
                        employeeId: localEmployeeId, date: rec.date,
                        checkIn: rec.check_in, checkOut: rec.check_out,
                        source: 'cloud', isCloudRecord: 1,
                    };
                    upsertRecord('attendance', rec.hr_local_id, localData);
                }
                totalImported += attendance.length;
            }

            if (payroll && payroll.length > 0) {
                for (const rec of payroll) {
                    const localEmployeeId = cloudToLocalEmpIdMap.get(rec.employee_id);
                    if (!localEmployeeId) continue;
                    const localData = {
                        employeeId: localEmployeeId, year: rec.year, month: rec.month,
                        weekNumber: rec.week_number, paymentType: rec.payment_type,
                        grossAmount: rec.gross_amount, advancesDeducted: rec.advances_deducted,
                        netAmount: rec.net_amount, paymentDate: rec.payment_date,
                        isCloudRecord: 1,
                    };
                    upsertRecord('payments', rec.hr_local_id, localData);
                }
                totalImported += payroll.length;
            }
            
            if (leaves && leaves.length > 0) {
                for (const rec of leaves) {
                    const localEmployeeId = cloudToLocalEmpIdMap.get(rec.employee_id);
                    if (!localEmployeeId) continue;
                    const localData = {
                        employeeId: localEmployeeId, type: rec.leave_type,
                        startDate: rec.start_date, endDate: rec.end_date,
                        reason: rec.reason, status: rec.status,
                        deductFromSalary: rec.deduct_from_salary,
                        isCloudRecord: 1,
                    };
                    upsertRecord('leaveRequests', rec.hr_local_id, localData);
                }
                totalImported += leaves.length;
            }

            if (advances && advances.length > 0) {
                for (const rec of advances) {
                    const localEmployeeId = cloudToLocalEmpIdMap.get(rec.employee_id);
                    if (!localEmployeeId) continue;
                    const localData = {
                        employeeId: localEmployeeId, amount: rec.amount,
                        currency: rec.currency || 'SYP', date: rec.request_date,
                        reason: rec.notes, status: rec.deduction_status,
                        isCloudRecord: 1,
                    };
                    upsertRecord('salaryAdvances', rec.hr_local_id, localData);
                }
                totalImported += advances.length;
            }

            if (bonuses && bonuses.length > 0) {
                for (const rec of bonuses) {
                    const localEmployeeId = cloudToLocalEmpIdMap.get(rec.employee_id);
                    if (!localEmployeeId) continue;
                    const localData = {
                        employeeId: localEmployeeId, amount: rec.amount,
                        currency: rec.currency || 'SYP', date: rec.bonus_date,
                        reason: rec.reason, isCloudRecord: 1,
                    };
                    upsertRecord('bonuses', rec.hr_local_id, localData);
                }
                totalImported += bonuses.length;
            }

            if (deductions && deductions.length > 0) {
                for (const rec of deductions) {
                    const localEmployeeId = cloudToLocalEmpIdMap.get(rec.employee_id);
                    if (!localEmployeeId) continue;
                    const localData = {
                        employeeId: localEmployeeId, amount: rec.amount,
                        currency: rec.currency || 'SYP', date: rec.deduction_date,
                        reason: rec.reason, isCloudRecord: 1,
                    };
                    upsertRecord('deductions', rec.hr_local_id, localData);
                }
                totalImported += deductions.length;
            }
        })();

        await db.updateSettings('lastCloudSyncDate', serverTimestamp);
        return { success: true, message: `تم جلب ${totalImported} سجل من السحابة.`, count: totalImported };

    } catch (error) {
        console.error('[Cloud Sync Download Error]', error);
        return { success: false, message: `خطأ في الجلب: ${error.message}` };
    }
}

module.exports = { uploadNewRecords, downloadCloudRecords };