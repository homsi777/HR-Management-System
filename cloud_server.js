const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// --------------------------------------------------------------------------
// 1. تهيئة اتصال Supabase
// --------------------------------------------------------------------------
const SUPABASE_URL = 'https://zsatdguvdpiuvsmbepuz.supabase.co';

// 🛑 تنبيه هام لنبيل: يجب استبدال هذا المفتاح بمفتاح "Service Role Key" الصحيح من لوحة تحكم Supabase
// إذا كان المفتاح غير صالح، سيتوقف الخادم عن العمل بـ "Invalid API key"
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzYXRkZ3V2ZHBpdXZzbWJlcHV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU0MTQ3NywiZXhwIjoyMDc2MTE3NDc3fQ.tR3IKnp8mKHbXUc4FSsEaScnDPeh9yocpCyaSxPTcpE';

// Initialize Supabase client with hr schema
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    db: {
        schema: 'hr'
    }
});

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'hr-center-id', 'hr-sync-key', 'since']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --------------------------------------------------------------------------
// 2. طبقة الحماية (Authentication Middleware)
// --------------------------------------------------------------------------
const authenticateRequest = async (req, res, next) => {
    try {
        const centerId = req.headers['hr-center-id']?.trim();
        const syncKey = req.headers['hr-sync-key']?.trim();
        if (!centerId || !syncKey || centerId !== syncKey) {
            return res.status(401).json({ 
                success: false, 
                message: 'بيانات المصادقة مفقودة أو غير متطابقة.' 
            });
        }
        
        // التحقق من المفتاح في قاعدة البيانات
        const { data: keyData, error: keyError } = await supabase
            .from('hr_activation_keys')
            .select('type')
            .eq('code', syncKey)
            .maybeSingle();

        if (keyError || !keyData || keyData.type !== 'Full') {
            await logSyncAttempt(centerId, 0, 'Failed', 'Invalid or Non-Full Key');
            return res.status(401).json({ 
                success: false, 
                message: 'مفتاح المزامنة غير صالح أو غير كامل.' 
            });
        }

        // الحصول على أو إنشاء المركز
        let { data: centerData } = await supabase
            .from('hr_centers')
            .select('id')
            .eq('center_id', centerId)
            .maybeSingle();

        if (!centerData) {
            const { data: newCenter } = await supabase
                .from('hr_centers')
                .insert({ center_id: centerId, sync_key: syncKey })
                .select('id')
                .single();
            centerData = newCenter;
        }

        req.centerId = centerData.id;
        req.centerIdString = centerId;
        next();

    } catch (authError) {
        console.error('[Auth] Unexpected error:', authError);
        // رسالة مفيدة للمستخدم
        res.status(500).json({ success: false, message: 'خطأ داخلي في الخادم. تأكد من صحة مفتاح Supabase Service Key.' });
    }
};

// تطبيق المصادقة على جميع endpoints المزامنة
app.use('/api/sync/hr', authenticateRequest);

// --------------------------------------------------------------------------
// 3. Helper Functions
// --------------------------------------------------------------------------
/**
 * يسجل محاولة مزامنة في جدول hr_sync_logs.
 * @param {string} centerId - معرف المركز في قاعدة البيانات السحابية (Cloud HR ID).
 * @param {number} count - عدد السجلات التي تمت معالجتها/تحميلها.
 * @param {string} status - حالة العملية ('Success', 'Failed').
 * @param {string|object} details - تفاصيل العملية أو الخطأ.
 */
async function logSyncAttempt(centerId, count, status, details) {
    if (!centerId) return;
    try {
        const { error } = await supabase.from('hr_sync_logs').insert({
            hr_center_id: centerId,
            records_uploaded_count: count,
            status: status,
            error_details: typeof details === 'string' ? details : JSON.stringify(details)
        });
        // 🛑 إذا فشل هذا السطر، فهذا هو الخطأ الذي رأيناه في [1]: "Invalid API key"
        if (error) console.error('[Log] Failed to log sync attempt:', error);
    } catch (err) {
        console.error('[Log] Exception while logging:', err);
    }
}

/**
 * يجلب خريطة (Map) تربط المعرف المحلي للموظف بالمعرف السحابي له.
 * @param {number} centerId - معرف المركز في قاعدة البيانات السحابية.
 * @returns {Promise<Map<number, number>>} - خريطة (Local ID -> Cloud ID).
 */
async function getLocalToCloudMap(centerId) {
    try {
        const { data } = await supabase
            .from('hr_employees')
            .select('id, hr_local_id')
            .eq('hr_center_id', centerId);
        // تحويل بيانات الاستجابة إلى Map: key=hr_local_id, value=id
        return new Map(data?.map(e => [e.hr_local_id, e.id]) || []);
    } catch (err) {
        console.error('[Map] Exception:', err);
        return new Map();
    }
}

// --------------------------------------------------------------------------
// 4. API Endpoints
// --------------------------------------------------------------------------

app.get('/', (req, res) => {
    res.json({ status: 'running', message: 'HR Sync API Server', version: '1.0.1' });
});

// مزامنة الموظفين
app.post('/api/sync/hr/upsert/employees', async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records)) return res.status(400).json({ success: false, message: 'البيانات المرسلة غير صالحة للموظفين.' });

        const formatted = records.map(r => ({
            hr_center_id: req.centerId,
            hr_local_id: r.id,
            hr_employee_code: `${req.centerIdString}-${r.employeeCode}`,
            name_full: r.name,
            biometric_id: r.biometricId || null,
            national_id: r.nationalId || null,
            branch_id: 1, department_id: 1, job_title_id: 1, // Default values
            status: r.status || 'active', 
            payment_type: r.paymentType || 'monthly',
            monthly_salary: r.monthlySalary || 0,
            hourly_rate: r.hourlyRate || 0,
            overtime_rate: r.overtimeRate || 0,
            salary_currency: r.salaryCurrency || 'SYP', 
            workdays: r.workdays ? JSON.stringify(r.workdays) : null,
            check_in_start_time: r.checkInStartTime || '08:00', 
            check_in_end_time: r.checkInEndTime || '17:00'
        }));
        
        const { error } = await supabase
            .from('hr_employees')
            .upsert(formatted, { onConflict: 'hr_center_id,hr_local_id' });
        
        if (error) throw error;
        
        await logSyncAttempt(req.centerId, records.length, 'Success', 'Employees Sync');
        res.json({ success: true, count: records.length });
        
    } catch (error) {
        console.error('[Cloud Error - Employees]', error);
        await logSyncAttempt(req.centerId, req.body.records?.length || 0, 'Failed', error.message);
        res.status(500).json({ success: false, message: 'فشل مزامنة الموظفين.', error: error.message });
    }
});


// مزامنة الحضور
app.post('/api/sync/hr/upsert/attendance', async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records)) return res.status(400).json({ success: false, message: 'البيانات المرسلة غير صالحة للحضور.' });

        const localToCloudMap = await getLocalToCloudMap(req.centerId);

        const formatted = records.map(r => {
            const cloudEmpId = localToCloudMap.get(r.employeeId);
            if (!cloudEmpId) return null;
            
            return {
                hr_center_id: req.centerId,
                hr_local_id: r.id,
                employee_id: cloudEmpId,
                date: r.date, check_in: r.checkIn || null, check_out: r.checkOut || null,
                check_out_type: r.checkOutType || 'normal', is_paid: r.isPaid || false,
                source: r.source || 'manual'
            };
        }).filter(Boolean);

        if (formatted.length > 0) {
            const { error } = await supabase
                .from('hr_attendance_daily')
                .upsert(formatted, { onConflict: 'hr_center_id,hr_local_id' });
            if (error) throw error;
        }
        await logSyncAttempt(req.centerId, formatted.length, 'Success', 'Attendance Sync');
        res.json({ success: true, count: formatted.length, skipped: records.length - formatted.length });

    } catch (error) {
        console.error('[Cloud Error - Attendance]', error);
        await logSyncAttempt(req.centerId, req.body.records?.length || 0, 'Failed', error.message);
        res.status(500).json({ success: false, message: 'خطأ في مزامنة الحضور.', error: error.message });
    }
});

// مزامنة الرواتب
app.post('/api/sync/hr/upsert/payroll', async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records)) return res.status(400).json({ success: false, message: 'Invalid payroll data.' });

        const localToCloudMap = await getLocalToCloudMap(req.centerId);
        
        const formatted = records.map(r => {
            const cloudEmpId = localToCloudMap.get(r.employeeId);
            if (!cloudEmpId) return null;
            
            return {
                hr_center_id: req.centerId, hr_local_id: r.id, employee_id: cloudEmpId,
                year: r.year, month: r.month, week_number: r.weekNumber || null,
                payment_type: r.paymentType || 'monthly',
                gross_amount: r.grossAmount || 0, advances_deducted: r.advancesDeducted || 0,
                net_amount: r.netAmount || 0,
                payment_date: r.paymentDate ? r.paymentDate.split('T')[0] : null 
            };
        }).filter(Boolean);

        if (formatted.length > 0) {
            const { error } = await supabase
                .from('hr_payroll_entries')
                .upsert(formatted, { onConflict: 'hr_center_id,hr_local_id' });
            if (error) throw error;
        }
        
        await logSyncAttempt(req.centerId, formatted.length, 'Success', 'Payroll Sync');
        res.json({ success: true, count: formatted.length, skipped: records.length - formatted.length });
        
    } catch (error) {
        console.error('[Cloud Error - Payroll]', error);
        await logSyncAttempt(req.centerId, req.body.records?.length || 0, 'Failed', error.message);
        res.status(500).json({ success: false, message: 'Error syncing payroll.', error: error.message });
    }
});

// مزامنة طلبات الإجازة (Leave Requests)
app.post('/api/sync/hr/upsert/leaveRequests', async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records)) return res.status(400).json({ success: false, message: 'Invalid leave request data.' });
        
        const localToCloudMap = await getLocalToCloudMap(req.centerId);

        const formatted = records.map(r => {
            const cloudEmpId = localToCloudMap.get(r.employeeId);
            if (!cloudEmpId) return null;
            
            return {
                hr_center_id: req.centerId,
                hr_local_id: r.id, 
                employee_id: cloudEmpId, 
                leave_type: r.type || 'Annual', 
                start_date: r.startDate, 
                end_date: r.endDate, 
                reason: r.reason,
                status: r.status || 'pending',
                request_date: new Date().toISOString().split('T')[0],
                deduct_from_salary: r.deductFromSalary || false, 
            };
        }).filter(Boolean);

        if (formatted.length > 0) {
            const { error } = await supabase
                .from('hr_leave_requests') 
                .upsert(formatted, { onConflict: 'hr_center_id,hr_local_id' });
            if (error) throw error;
        }
        
        await logSyncAttempt(req.centerId, formatted.length, 'Success', 'LeaveRequests Sync');
        res.json({ success: true, count: formatted.length, skipped: records.length - formatted.length });
        
    } catch (error) {
        console.error('[Cloud Error - Leave Requests]', error);
        await logSyncAttempt(req.centerId, req.body.records?.length || 0, 'Failed', error.message);
        res.status(500).json({ success: false, message: 'Error syncing leave requests.', error: error.message });
    }
});

// مزامنة السلف (Salary Advances)
app.post('/api/sync/hr/upsert/salaryAdvances', async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records)) return res.status(400).json({ success: false, message: 'Invalid salary advance data.' });

        const localToCloudMap = await getLocalToCloudMap(req.centerId);
        
        const formatted = records.map(r => {
            const cloudEmpId = localToCloudMap.get(r.employeeId);
            if (!cloudEmpId) return null;
            
            return {
                hr_center_id: req.centerId, 
                hr_local_id: r.id, 
                employee_id: cloudEmpId, 
                amount: r.amount || 0,
                request_date: r.date, 
                deduction_status: r.status || 'Approved',
                notes: r.reason || '',
                is_deducted: r.isDeducted || false
            };
        }).filter(Boolean);

        if (formatted.length > 0) {
            const { error } = await supabase
                .from('hr_salary_advances') 
                .upsert(formatted, { onConflict: 'hr_center_id,hr_local_id' });
            if (error) throw error;
        }
        
        await logSyncAttempt(req.centerId, formatted.length, 'Success', 'SalaryAdvances Sync');
        res.json({ success: true, count: formatted.length, skipped: records.length - formatted.length });
        
    } catch (error) {
        console.error('[Cloud Error - Salary Advances]', error);
        await logSyncAttempt(req.centerId, req.body.records?.length || 0, 'Failed', error.message);
        res.status(500).json({ success: false, message: 'Error syncing salary advances.', error: error.message });
    }
});


// مزامنة المكافآت (Bonuses)
app.post('/api/sync/hr/upsert/bonuses', async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records)) return res.status(400).json({ success: false, message: 'Invalid bonus data.' });

        const localToCloudMap = await getLocalToCloudMap(req.centerId);
        
        const formatted = records.map(r => {
            const cloudEmpId = localToCloudMap.get(r.employeeId);
            if (!cloudEmpId) return null;
            
            return {
                hr_center_id: req.centerId, 
                hr_local_id: r.id, 
                employee_id: cloudEmpId, 
                amount: r.amount || 0,
                reason: r.reason || '',
                bonus_date: r.date ? r.date.split('T')[0] : new Date().toISOString().split('T')[0], 
            };
        }).filter(Boolean);

        if (formatted.length > 0) {
            const { error } = await supabase
                .from('hr_bonuses') 
                .upsert(formatted, { onConflict: 'hr_center_id,hr_local_id' });
            if (error) throw error;
        }
        
        await logSyncAttempt(req.centerId, formatted.length, 'Success', 'Bonuses Sync');
        res.json({ success: true, count: formatted.length, skipped: records.length - formatted.length });
        
    } catch (error) {
        console.error('[Cloud Error - Bonuses]', error);
        await logSyncAttempt(req.centerId, req.body.records?.length || 0, 'Failed', error.message);
        res.status(500).json({ success: false, message: 'Error syncing bonuses.', error: error.message });
    }
});

// مزامنة الاستقطاعات (Deductions)
app.post('/api/sync/hr/upsert/deductions', async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records)) return res.status(400).json({ success: false, message: 'Invalid deduction data.' });

        const localToCloudMap = await getLocalToCloudMap(req.centerId);
        
        const formatted = records.map(r => {
            const cloudEmpId = localToCloudMap.get(r.employeeId);
            if (!cloudEmpId) return null;
            
            return {
                hr_center_id: req.centerId, 
                hr_local_id: r.id, 
                employee_id: cloudEmpId, 
                amount: r.amount || 0,
                reason: r.reason || '',
                deduction_date: r.date ? r.date.split('T')[0] : new Date().toISOString().split('T')[0],
            };
        }).filter(Boolean);

        if (formatted.length > 0) {
            const { error } = await supabase
                .from('hr_deductions') 
                .upsert(formatted, { onConflict: 'hr_center_id,hr_local_id' });
            if (error) throw error;
        }
        
        await logSyncAttempt(req.centerId, formatted.length, 'Success', 'Deductions Sync');
        res.json({ success: true, count: formatted.length, skipped: records.length - formatted.length });
        
    } catch (error) {
        console.error('[Cloud Error - Deductions]', error);
        await logSyncAttempt(req.centerId, req.body.records?.length || 0, 'Failed', error.message);
        res.status(500).json({ success: false, message: 'Error syncing deductions.', error: error.message });
    }
});


// تنزيل البيانات من السحابة (Download Endpoint)
app.get('/api/sync/hr/download', async (req, res) => {
    try {
        const since = req.headers['since'];
        const centerId = req.centerId;

        const tablesToFetch = [
            'hr_employees', 
            'hr_attendance_daily', 
            'hr_payroll_entries', 
            'hr_leave_requests', 
            'hr_salary_advances', 
            'hr_bonuses', 
            'hr_deductions'
        ];

        const queries = tablesToFetch.map(table => {
            let query = supabase.from(table).select('*').eq('hr_center_id', centerId);
            if (since && table !== 'hr_employees') {
                query = query.gt('created_at', since);
            }
            return query;
        });

        const results = await Promise.all(queries);

        const errors = results.map((r, i) => r.error ? { table: tablesToFetch[i], error: r.error } : null).filter(Boolean);
        if (errors.length > 0) {
            console.error('[Download Error] Failed to fetch some tables:', errors);
            return res.status(500).json({ success: false, message: 'Failed to fetch some cloud data.', errors });
        }

        const data = {
            employees: results[0].data || [],
            attendance: results[1].data || [],
            payroll: results[2].data || [],
            leaves: results[3].data || [],
            advances: results[4].data || [],
            bonuses: results[5].data || [],
            deductions: results[6].data || []
        };
        
        res.json({ success: true, data, timestamp: new Date().toISOString() });
        
    } catch (error) {
        console.error('[Download] Unhandled error:', error);
        res.status(500).json({ success: false, message: 'Error downloading data.', error: error.message });
    }
});

// --------------------------------------------------------------------------
// 5. Start Server
// --------------------------------------------------------------------------
app.listen(port, () => {
    console.log(`=====================================`);
    console.log(`HR Sync API Server`);
    console.log(`Port: ${port}`);
    console.log(`Status: Running`);
    console.log(`=====================================`);
});

module.exports = app;