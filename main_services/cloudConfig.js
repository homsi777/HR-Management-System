// main_services/cloudConfig.js

// إعدادات الاتصال بالخادم السحابي الوسيط (Node.js Server -> Supabase)
// تأكد من تشغيل الخادم عبر الأمر: npm run server

const SERVER_BASE_URL = "http://localhost:3000"; // رابط الخادم المحلي

// مسارات API
const CLOUD_UPLOAD_EMPLOYEES_URL = `${SERVER_BASE_URL}/api/sync/hr/upsert/employees`;
const CLOUD_UPLOAD_ATTENDANCE_URL = `${SERVER_BASE_URL}/api/sync/hr/upsert/attendance`;
const CLOUD_UPLOAD_PAYROLL_URL = `${SERVER_BASE_URL}/api/sync/hr/upsert/payroll`;
// تم التصحيح: يجب أن يكون leaveRequests ليطابق المسار في الخادم
const CLOUD_UPLOAD_LEAVES_URL = `${SERVER_BASE_URL}/api/sync/hr/upsert/leaveRequests`; 
// تم التصحيح: يجب أن يكون salaryAdvances ليطابق المسار في الخادم
const CLOUD_UPLOAD_ADVANCES_URL = `${SERVER_BASE_URL}/api/sync/hr/upsert/salaryAdvances`; 
const CLOUD_UPLOAD_BONUSES_URL = `${SERVER_BASE_URL}/api/sync/hr/upsert/bonuses`;
const CLOUD_UPLOAD_DEDUCTIONS_URL = `${SERVER_BASE_URL}/api/sync/hr/upsert/deductions`;

const CLOUD_DOWNLOAD_URL = `${SERVER_BASE_URL}/api/sync/hr/download`;

module.exports = {
    CLOUD_UPLOAD_EMPLOYEES_URL,
    CLOUD_UPLOAD_ATTENDANCE_URL,
    CLOUD_UPLOAD_PAYROLL_URL,
    CLOUD_UPLOAD_LEAVES_URL,
    CLOUD_UPLOAD_ADVANCES_URL,
    CLOUD_UPLOAD_BONUSES_URL,
    CLOUD_UPLOAD_DEDUCTIONS_URL,
    CLOUD_DOWNLOAD_URL,
    API_SECRET_KEY: "Nabeel_Loves_Google_2025_Secret" 
};