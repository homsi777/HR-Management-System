
import React from 'react';
import { Employee, Department, JobTitle, LeaveRequest, SalaryAdvance, SalaryCurrency, LeaveType, LeaveStatus } from '../../types';

const leaveTypeTranslations: Record<LeaveType, string> = { 'Annual': 'سنوية', 'Sick': 'مرضية', 'Emergency': 'طارئة', 'Unpaid': 'بدون راتب' };
const leaveStatusTranslations: Record<LeaveStatus, string> = { 'Approved': 'موافق عليه', 'Pending': 'قيد الانتظار', 'Rejected': 'مرفوض' };
const checkInTypeTranslations: Record<NonNullable<Employee['checkInType']>, string> = { 'nfc': 'بطاقة NFC', 'fingerprint': 'بصمة اصبع', 'face': 'بصمة وجه' };

interface EmployeeProfileReportData {
    type: 'employee_profile';
    needsSelection?: boolean;
    error?: string;
    employee?: Employee;
    summary?: {
        presentDays: number;
        absentDays: number;
        leaveDays: number;
        lateCount: number;
        totalWorkDays: number;
        totalHours: number;
        overtimeHours: number;
    };
    leaves?: LeaveRequest[];
    advances?: SalaryAdvance[];
    payroll?: {
        baseSalary: number;
        overtimePay: number;
        bonusesTotal: number;
        latenessDeductions: number;
        manualDeductionsTotal: number;
        unpaidLeaveDeductions: number;
        advancesTotal: number;
        netSalary: number;
    };
}

interface EmployeeProfileReportProps {
    data: EmployeeProfileReportData;
    startDate: string;
    endDate: string;
    departments: Department[];
    jobTitles: JobTitle[];
}

const EmployeeProfileReport: React.FC<EmployeeProfileReportProps> = ({ data, startDate, endDate, departments, jobTitles }) => {

    const getDepartmentName = (id: number) => departments.find(d => d.id === id)?.name || 'N/A';
    const getJobTitleName = (id: number) => jobTitles.find(j => j.id === id)?.name || 'N/A';
    
    if (data.needsSelection) {
        return <div className="text-center py-10 text-gray-500">الرجاء اختيار موظف لعرض التقرير.</div>;
    }
    if (data.error) {
        return <div className="text-center py-10 text-red-500">{data.error}</div>;
    }

    const { employee, summary, leaves, advances, payroll } = data;
    if (!employee || !summary || !leaves || !advances || !payroll) {
        return <div className="text-center py-10 text-gray-500">لا توجد بيانات كافية لعرض التقرير.</div>;
    }

    const totalDeductions = (payroll.latenessDeductions || 0) + (payroll.manualDeductionsTotal || 0) + (payroll.unpaidLeaveDeductions || 0);

    return (
        <div className="p-4 space-y-6">
            <div className="text-center border-b pb-4">
                <h3 className="text-2xl font-bold text-neutral">تقرير الموظف: {employee.name}</h3>
                <p className="text-gray-500">للفترة من {startDate} إلى {endDate}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg space-y-1">
                    <h4 className="font-bold text-lg mb-2">معلومات الموظف</h4>
                    <p><strong>الرقم الوطني:</strong> {employee.nationalId || 'غير مسجل'}</p>
                    <p><strong>رقم الهاتف:</strong> {employee.phone || 'غير مسجل'}</p>
                    <p><strong>القسم:</strong> {getDepartmentName(employee.departmentId)}</p>
                    <p><strong>المسمى الوظيفي:</strong> {getJobTitleName(employee.jobTitleId)}</p>
                    <p><strong>تاريخ التعيين:</strong> {employee.hireDate}</p>
                    
                    <p className="border-t pt-2 mt-2 font-semibold">تفاصيل الراتب الأساسي:</p>
                    {employee.calculateSalaryBy30Days && <p className="text-sm text-blue-600 font-medium">(يتم احتساب الراتب على 30 يوم عمل شامل العطل)</p>}
                    {employee.paymentType === 'monthly' && <p><strong>الراتب الشهري:</strong> {`${(employee.monthlySalary || 0).toFixed(2)} ${employee.salaryCurrency || ''}`}</p>}
                    {employee.paymentType === 'weekly' && <p><strong>الراتب الأسبوعي:</strong> {`${(employee.weeklySalary || 0).toFixed(2)} ${employee.salaryCurrency || ''}`}</p>}
                    <p><strong>ساعات العمل اليومية:</strong> {employee.agreedDailyHours || 'غير محدد'}</p>
                    {(employee.hourlyRate > 0 || employee.paymentType === 'hourly') && <p><strong>أجر الساعة (للإضافي/الحسم):</strong> {`${(employee.hourlyRate || 0).toFixed(2)} ${employee.salaryCurrency || ''}`}</p>}
                    {(employee.overtimeRate > 0 || employee.paymentType === 'hourly') && <p><strong>أجر الساعة الإضافية:</strong> {`${(employee.overtimeRate || 0).toFixed(2)} ${employee.salaryCurrency || ''}`}</p>}

                    <p className="border-t pt-2 mt-2"><strong>نوع التسجيل:</strong> {employee.checkInType ? checkInTypeTranslations[employee.checkInType] : 'غير محدد'}</p>
                </div>
                 <div className="bg-white border-2 border-gray-100 p-4 rounded-lg space-y-2 shadow-sm">
                     <h4 className="font-bold text-lg mb-3 text-center bg-gray-100 p-2 rounded">ملخص الراتب للفترة المحددة</h4>
                     <div className="flex justify-between items-center text-green-700">
                         <span>الراتب الأساسي (للفترة):</span>
                         <span className="font-mono">{`${payroll.baseSalary.toFixed(2)}`}</span>
                     </div>
                     <div className="flex justify-between items-center text-green-700">
                         <span>مكافآت:</span>
                         <span className="font-mono">{`+ ${payroll.bonusesTotal.toFixed(2)}`}</span>
                     </div>
                     <div className="flex justify-between items-center text-green-700">
                         <span>عمل إضافي:</span>
                         <span className="font-mono">{`+ ${payroll.overtimePay.toFixed(2)}`}</span>
                     </div>
                     <div className="border-t my-1"></div>
                     <div className="flex justify-between items-center text-red-600">
                         <span>خصم غياب/تأخير:</span>
                         <span className="font-mono">{`- ${(payroll.unpaidLeaveDeductions + payroll.latenessDeductions).toFixed(2)}`}</span>
                     </div>
                     <div className="flex justify-between items-center text-red-600">
                         <span>خصميات يدوية:</span>
                         <span className="font-mono">{`- ${payroll.manualDeductionsTotal.toFixed(2)}`}</span>
                     </div>
                     <div className="flex justify-between items-center text-orange-600">
                         <span>سلف مستحقة:</span>
                         <span className="font-mono">{`- ${payroll.advancesTotal.toFixed(2)}`}</span>
                     </div>
                     <div className="border-t-2 border-black my-2"></div>
                     <div className="flex justify-between items-center font-bold text-xl bg-gray-50 p-2 rounded">
                         <span>صافي الراتب المستحق:</span>
                         <span className="font-mono text-primary">{`${payroll.netSalary.toFixed(2)} ${employee.salaryCurrency || ''}`}</span>
                     </div>
                </div>
            </div>

            <div>
                <h4 className="font-bold text-lg mb-2 mt-4">الصور والمستندات</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                    <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-2">الصورة الشخصية</h5>
                        <div className="w-40 h-40 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-gray-300 mx-auto">
                            {employee.photo ? <img src={`data:image/jpeg;base64,${employee.photo}`} alt={employee.name} className="w-full h-full object-cover" /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                        </div>
                    </div>
                    <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-2">صورة الهوية (الوجه الأمامي)</h5>
                        <div className="w-64 h-40 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-gray-300 mx-auto">
                            {employee.idPhotoFront ? <img src={`data:image/jpeg;base64,${employee.idPhotoFront}`} alt="ID Front" className="w-full h-full object-cover" /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>}
                        </div>
                    </div>
                    <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-2">صورة الهوية (الوجه الخلفي)</h5>
                        <div className="w-64 h-40 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-gray-300 mx-auto">
                            {employee.idPhotoBack ? <img src={`data:image/jpeg;base64,${employee.idPhotoBack}`} alt="ID Back" className="w-full h-full object-cover" /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>}
                        </div>
                    </div>
                </div>
            </div>

            <div>
                 <h4 className="font-bold text-lg mb-2">ملخص الدوام</h4>
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                    <div className="bg-blue-100 p-3 rounded-lg">
                        <p className="font-bold text-2xl">{summary.totalWorkDays}</p>
                        <p className="text-sm">أيام عمل</p>
                        {employee.calculateSalaryBy30Days && <p className="text-xs font-bold">(شهرياً)</p>}
                    </div>
                    <div className="bg-green-100 p-3 rounded-lg"><p className="font-bold text-2xl">{summary.presentDays}</p><p className="text-sm">حضور</p></div>
                    <div className="bg-red-100 p-3 rounded-lg"><p className="font-bold text-2xl">{summary.absentDays}</p><p className="text-sm">غياب</p></div>
                    <div className="bg-yellow-100 p-3 rounded-lg"><p className="font-bold text-2xl">{summary.leaveDays}</p><p className="text-sm">إجازة</p></div>
                    <div className="bg-orange-100 p-3 rounded-lg"><p className="font-bold text-2xl">{summary.lateCount}</p><p className="text-sm">تأخير</p></div>
                 </div>
            </div>
            
             {employee.cvFile && employee.cvFileName && (
                <div>
                    <h4 className="font-bold text-lg mb-2 mt-4">المرفقات</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="font-semibold">{employee.cvFileName}</p>
                        {employee.cvFileType?.startsWith('image/') ? <img src={`data:${employee.cvFileType};base64,${employee.cvFile}`} alt={employee.cvFileName} className="max-w-xs h-auto mt-2 rounded border" /> : <p className="text-sm text-gray-600">(ملف مستند) - <a href={`data:${employee.cvFileType};base64,${employee.cvFile}`} download={employee.cvFileName} className="text-blue-500 hover:underline">تحميل الملف</a></p>}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 className="font-bold text-lg mb-2">كشف الإجازات</h4>
                    {leaves.length > 0 ? (<table className="min-w-full text-sm"><thead className="bg-gray-100"><tr><th className="p-2">النوع</th><th className="p-2">من</th><th className="p-2">إلى</th></tr></thead><tbody>{leaves.map(l => <tr key={l.id} className="border-b"><td className="p-2">{leaveTypeTranslations[l.type]}</td><td className="p-2">{l.startDate}</td><td className="p-2">{l.endDate}</td></tr>)}</tbody></table>) : <p className="text-gray-500">لا توجد إجازات في هذه الفترة.</p>}
                </div>
                 <div>
                    <h4 className="font-bold text-lg mb-2">كشف السلف</h4>
                    {advances.length > 0 ? (<table className="min-w-full text-sm"><thead className="bg-gray-100"><tr><th className="p-2">التاريخ</th><th className="p-2">المبلغ</th></tr></thead><tbody>{advances.map(a => <tr key={a.id} className="border-b"><td className="p-2">{a.date}</td><td className="p-2">{a.amount.toFixed(2)}</td></tr>)}</tbody></table>) : <p className="text-gray-500">لا توجد سلف في هذه الفترة.</p>}
                </div>
            </div>
        </div>
    );
};

export default EmployeeProfileReport;
