import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ICONS } from '../constants';
import { 
    Employee, AttendanceRecord, LeaveRequest, SalaryAdvance, Bonus, Deduction, 
    Department, JobTitle, Payment, Custody, Termination, IElectronAPI, 
    MaintenanceStaff, MaintenanceRecord, Client, ClientTask, WorkScheduleHistory 
} from '../types';

import AttendanceSummaryReport from './reports/AttendanceSummaryReport';
import DetailedHoursReport from './reports/DetailedHoursReport';
import PayrollReport from './reports/PayrollReport';
import MaintenanceReport from './reports/MaintenanceReport';
import TerminatedEmployeesReport from './reports/TerminatedEmployeesReport';
import DeductionsReport from './reports/DeductionsReport';
import LeaveReport from './reports/LeaveReport';
import EmployeeProfileReport from './reports/EmployeeProfileReport';
import EmployeeContractsReport from './reports/EmployeeContractsReport';
import ClientsReport from './reports/ClientsReport';
import ManualAttendanceReport from './reports/ManualAttendanceReport';

interface ReportsProps {
    employees: Employee[];
    attendance: AttendanceRecord[];
    leaveRequests: LeaveRequest[];
    salaryAdvances: SalaryAdvance[];
    bonuses: Bonus[];
    deductions: Deduction[];
    departments: Department[];
    jobTitles: JobTitle[];
    workdays: number[];
    payments: Payment[];
    custody: Custody[];
    terminations: Termination[];
    api: IElectronAPI;
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
    maintenanceStaff: MaintenanceStaff[];
    maintenanceRecords: MaintenanceRecord[];
    clients: Client[];
    clientTasks: ClientTask[];
}

const Reports: React.FC<ReportsProps> = ({
    employees, attendance, leaveRequests, salaryAdvances, bonuses, deductions,
    departments, jobTitles, workdays, payments, custody, terminations,
    api, setToast, maintenanceStaff, maintenanceRecords, clients, clientTasks
}) => {
    const [reportType, setReportType] = useState('attendance_summary');
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterDepartment, setFilterDepartment] = useState<'all' | number>('all');
    const [filterEmployeeId, setFilterEmployeeId] = useState<'all' | number>('all');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);
    
    // State for report data (now loaded asynchronously for complex reports)
    const [reportData, setReportData] = useState<any | any[]>([]);
    const [isLoadingReport, setIsLoadingReport] = useState(false);

    const getEmployeeName = (id: number) => employees.find(e => e.id === id)?.name || 'Unknown';
    const getDepartmentName = (id: number) => departments.find(d => d.id === id)?.name || 'N/A';
    const getJobTitleName = (id: number) => jobTitles.find(j => j.id === id)?.name || 'N/A';

    const requestSort = (key: string) => {
        setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending' }));
    };

    const getSortIndicator = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    // Effect to generate report data whenever dependencies change
    useEffect(() => {
        const generateReport = async () => {
            setIsLoadingReport(true);
            let rows: any[] | any = [];
            
            // Helper to check if a date is within range
            const isWithinRange = (date: string) => date >= startDate && date <= endDate;

            try {
                switch (reportType) {
                    case 'terminated_employees_report':
                        rows = terminations
                            .filter(t => isWithinRange(t.terminationDate))
                            .map(termination => {
                                const employee = employees.find(e => e.id === termination.employeeId);
                                return {
                                    id: termination.id,
                                    employeeName: employee?.name || 'غير معروف (محذوف)',
                                    departmentName: employee ? getDepartmentName(employee.departmentId) : 'N/A',
                                    jobTitleName: employee ? getJobTitleName(employee.jobTitleId) : 'N/A',
                                    biometricId: employee?.biometricId || 'N/A',
                                    terminationDate: termination.terminationDate,
                                    reason: termination.reason,
                                    notes: termination.notes,
                                    departmentId: employee?.departmentId,
                                    financialData: termination.financialData ? JSON.parse(termination.financialData) : null
                                };
                            })
                            .filter(t => filterDepartment === 'all' || t.departmentId === filterDepartment);
                        break;

                    case 'attendance_summary':
                        rows = employees.filter(e => e.status === 'active' && (filterDepartment === 'all' || e.departmentId === filterDepartment)).map(emp => {
                            const empAttendance = attendance.filter(a => a.employeeId === emp.id && isWithinRange(a.date));
                            const presentDays = new Set(empAttendance.map(a => a.date)).size;
                            
                            const empWorkdays = new Set(emp.workdays && emp.workdays.length > 0 ? emp.workdays : workdays);
                            let requiredDays = 0;
                            const d = new Date(startDate);
                            const end = new Date(endDate);
                            while (d <= end) {
                                if (empWorkdays.has(d.getDay())) requiredDays++;
                                d.setDate(d.getDate() + 1);
                            }
                            
                            const leaveDays = leaveRequests
                                .filter(l => l.employeeId === emp.id && l.status === 'Approved' && l.startDate <= endDate && l.endDate >= startDate)
                                .reduce((acc, curr) => acc + 1, 0); // Simplified

                            const lateCount = empAttendance.filter(a => emp.checkInEndTime && a.checkIn > emp.checkInEndTime).length;

                            return {
                                employeeId: emp.id,
                                employeeName: emp.name,
                                presentDays,
                                absentDays: Math.max(0, requiredDays - presentDays - leaveDays),
                                leaveDays,
                                lateCount
                            };
                        });
                        break;
                    
                    case 'detailed_hours':
                        // First, fetch schedule history to calculate historical requirements accurately
                        const scheduleHistory: WorkScheduleHistory[] = await api.db.getAll('work_schedule_history');
                        // Helper to find agreed hours for a date from history
                        const getAgreedHoursForDate = (empId: number, dateStr: string, currentVal: number) => {
                            const employeeSchedules = scheduleHistory
                                .filter(s => s.employeeId === empId)
                                .sort((a, b) => b.startDate.localeCompare(a.startDate)); // DESC
                            const schedule = employeeSchedules.find(s => s.startDate <= dateStr);
                            return schedule ? schedule.hours : currentVal;
                        };

                        rows = employees
                            .filter(e => e.status === 'active' && (filterDepartment === 'all' || e.departmentId === filterDepartment))
                            .map(emp => {
                                const empAttendance = attendance.filter(a => a.employeeId === emp.id && isWithinRange(a.date));
                                const empWorkdays = new Set(emp.workdays && emp.workdays.length > 0 ? emp.workdays : workdays);
                                
                                let totalRequiredHours = 0;
                                let totalActualHours = 0;
                                let totalRegularWorked = 0;
                                let totalOvertime = 0;
                                
                                const detailedRecords = [];
                                const d = new Date(startDate);
                                const end = new Date(endDate);
                                
                                while (d <= end) {
                                    const dateStr = d.toISOString().split('T')[0];
                                    const dayId = d.getDay();
                                    const isWorkday = empWorkdays.has(dayId);
                                    const record = empAttendance.find(a => a.date === dateStr);
                                    const dayName = d.toLocaleDateString('ar-EG', { weekday: 'long' });

                                    // Use historical schedule logic
                                    const dailyAgreedHours = getAgreedHoursForDate(emp.id, dateStr, emp.agreedDailyHours || 8);
                                    let required = isWorkday ? dailyAgreedHours : 0;
                                    
                                    let actual = 0;
                                    let regular = 0;
                                    let overtime = 0;
                                    let status = 'غياب';
                                    let checkIn = '-';
                                    let checkOut = '-';

                                    if (record) {
                                        status = 'حضور';
                                        checkIn = record.checkIn;
                                        checkOut = record.checkOut || '-';
                                        if (record.checkIn && record.checkOut) {
                                            const checkInTime = new Date(`${dateStr}T${record.checkIn}`).getTime();
                                            let checkOutTime = new Date(`${dateStr}T${record.checkOut}`).getTime();
                                            
                                            // Handle overnight shifts (if checkout time is smaller than checkin, assume next day)
                                            if (checkOutTime <= checkInTime) {
                                                checkOutTime += 24 * 60 * 60 * 1000;
                                            }

                                            const diff = (checkOutTime - checkInTime) / 3600000;
                                            actual = Math.max(0, diff);
                                            
                                            // Overtime Calculation Logic
                                            if (emp.checkOutEndTime) {
                                                let threshold = new Date(`${dateStr}T${emp.checkOutEndTime}`).getTime();
                                                // If the threshold is earlier than check-in (e.g. shift starts 17:00, threshold is 02:00 next day)
                                                // we must shift threshold to the next day relative to the dateStr
                                                if (threshold <= checkInTime) {
                                                    threshold += 24 * 60 * 60 * 1000;
                                                }
                                                
                                                if (checkOutTime > threshold) {
                                                    overtime = (checkOutTime - threshold) / 3600000;
                                                }
                                            } else {
                                                // Standard logic: Anything above required is overtime
                                                overtime = Math.max(0, actual - required);
                                            }
                                            
                                            // Ensure Regular doesn't go below 0
                                            regular = Math.max(0, actual - overtime);
                                        }
                                    } else if (!isWorkday) {
                                        status = 'عطلة';
                                    } else {
                                        const onLeave = leaveRequests.some(l => l.employeeId === emp.id && l.status === 'Approved' && l.startDate <= dateStr && l.endDate >= dateStr);
                                        if (onLeave) status = 'إجازة';
                                    }

                                    detailedRecords.push({ date: dateStr, dayName, status, checkIn, checkOut, required, actual, regular, overtime });
                                    totalRequiredHours += required;
                                    totalActualHours += actual;
                                    totalRegularWorked += regular;
                                    totalOvertime += overtime;
                                    d.setDate(d.getDate() + 1);
                                }

                                return {
                                    employeeId: emp.id,
                                    employeeName: emp.name,
                                    totalRequiredHours,
                                    totalActualHours,
                                    totalRegularWorked,
                                    totalOvertime,
                                    detailedRecords
                                };
                            });
                        break;

                    case 'payroll_report':
                        // Use Async API Calculation for Accuracy
                        const targetEmployees = employees.filter(e => e.status === 'active' && (filterDepartment === 'all' || e.departmentId === filterDepartment));
                        
                        const payrollPromises = targetEmployees.map(async (emp) => {
                            // Fetch exact calculation from backend engine
                            const calc = await api.payroll.calculate({ employeeId: emp.id, startDate, endDate });
                            
                            // Re-calculate deductions visual grouping if needed, but backend 'totalDeductions' includes lateness/absence/manual
                            // We just need to ensure the report displays what the user wants.
                            
                            return {
                                employeeId: emp.id,
                                employeeName: emp.name,
                                baseSalary: calc.baseSalary,
                                bonuses: calc.bonusesTotal,
                                overtimePay: calc.overtimePay,
                                totalOvertimeHours: calc.totalOvertimeHours,
                                // Group all deductions: Manual + Lateness + Absence
                                totalDeductions: calc.totalDeductions, 
                                advances: calc.advancesTotal,
                                netSalary: calc.netSalary, // This net salary is (Earnings - Deductions - Advances)
                                salaryCurrency: emp.salaryCurrency,
                                calculateSalaryBy30Days: emp.calculateSalaryBy30Days,
                                // Add breakdown for tooltip or detailed view if needed
                                latenessDeductions: calc.latenessDeductions,
                                unpaidLeaveDeductions: calc.unpaidLeaveDeductions
                            };
                        });
                        
                        rows = await Promise.all(payrollPromises);
                        break;

                    case 'maintenance_report':
                        rows = maintenanceRecords
                            .filter(r => isWithinRange(r.date))
                            .map(r => ({...r, employeeName: getEmployeeName(r.employeeId)}))
                            .filter(r => {
                                const emp = employees.find(e => e.id === r.employeeId);
                                return filterDepartment === 'all' || emp?.departmentId === filterDepartment;
                            });
                        break;

                    case 'deductions_report': 
                        rows = deductions
                            .filter(d => isWithinRange(d.date))
                            .map(d => ({...d, employeeName: getEmployeeName(d.employeeId)}));
                        break;

                    case 'leaves_report':
                        rows = leaveRequests
                            .filter(l => (l.startDate >= startDate && l.startDate <= endDate) || (l.endDate >= startDate && l.endDate <= endDate))
                            .map(l => ({...l, employeeName: getEmployeeName(l.employeeId)}));
                        break;

                    case 'manual_attendance': 
                        rows = attendance
                            .filter(a => a.source === 'manual' && isWithinRange(a.date))
                            .map(a => ({...a, employeeName: getEmployeeName(a.employeeId)}));
                        break;
                    
                    case 'employee_contracts':
                        rows = employees
                            .filter(e => e.employmentType === 'contract' && (filterDepartment === 'all' || e.departmentId === filterDepartment))
                            .map(e => {
                                const today = new Date();
                                const end = e.contractEndDate ? new Date(e.contractEndDate) : null;
                                let status = 'ساري';
                                if (end) {
                                    if (end < today) status = 'منتهي';
                                    else if ((end.getTime() - today.getTime()) / (1000 * 3600 * 24) < 30) status = 'على وشك الانتهاء';
                                } else {
                                    status = 'غير محدد';
                                }
                                return {
                                    employeeId: e.id,
                                    employeeName: e.name,
                                    departmentName: getDepartmentName(e.departmentId),
                                    contractStartDate: e.contractStartDate || '-',
                                    contractEndDate: e.contractEndDate || '-',
                                    status,
                                    contractFile: e.contractFile,
                                    contractFileName: e.contractFileName,
                                    contractFileType: e.contractFileType
                                };
                            });
                        break;

                    case 'employee_profile':
                        if (filterEmployeeId === 'all') {
                            rows = { type: 'employee_profile', needsSelection: true };
                        } else {
                            const emp = employees.find(e => e.id === filterEmployeeId);
                            if (emp) {
                                const empAttendance = attendance.filter(a => a.employeeId === emp.id && isWithinRange(a.date));
                                const presentDays = new Set(empAttendance.map(a => a.date)).size;
                                const lateCount = empAttendance.filter(a => emp.checkInEndTime && a.checkIn > emp.checkInEndTime).length;
                                
                                // Calculate accurate payroll data for the profile
                                const payrollData = await api.payroll.calculate({ 
                                    employeeId: emp.id, 
                                    startDate, 
                                    endDate 
                                });

                                rows = { 
                                    type: 'employee_profile', 
                                    employee: emp,
                                    summary: { 
                                        presentDays, 
                                        absentDays: 0, 
                                        leaveDays: 0, 
                                        lateCount, 
                                        totalWorkDays: 0, 
                                        totalHours: payrollData.totalWorkedHours, 
                                        overtimeHours: payrollData.totalOvertimeHours 
                                    },
                                    leaves: leaveRequests.filter(l => l.employeeId === emp.id && isWithinRange(l.startDate)),
                                    advances: salaryAdvances.filter(a => a.employeeId === emp.id && isWithinRange(a.date)),
                                    // Pass the fully calculated payroll object
                                    payroll: payrollData 
                                };
                            }
                        }
                        break;
                    
                    case 'clients_report': 
                        rows = []; // Handled by component props
                        break;

                    default: 
                        rows = [];
                }
                
                // Sorting for array data
                if (Array.isArray(rows) && sortConfig) {
                    rows.sort((a, b) => {
                        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
                        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
                        return 0;
                    });
                }
                setReportData(rows);

            } catch (error) {
                console.error("Error generating report:", error);
                setToast({ message: 'حدث خطأ أثناء توليد التقرير.', type: 'error' });
            } finally {
                setIsLoadingReport(false);
            }
        };

        generateReport();
    }, [reportType, startDate, endDate, filterDepartment, filterEmployeeId, sortConfig, employees, attendance, terminations, maintenanceRecords, deductions, leaveRequests, departments, jobTitles, salaryAdvances, bonuses, workdays]);


    const handleExport = () => {
        if (Array.isArray(reportData) && reportData.length > 0) {
            const ws = XLSX.utils.json_to_sheet(reportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Report");
            XLSX.writeFile(wb, `${reportType}.xlsx`);
        } else {
            setToast({ message: 'لا توجد بيانات قابلة للتصدير.', type: 'info' });
        }
    };

    const handlePrint = () => {
        api.app.print({});
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6 no-print">
                <h2 className="text-2xl font-bold text-neutral">التقارير</h2>
                <div className="flex items-center gap-2">
                    <button onClick={handleExport} className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2">{ICONS.export} تصدير</button>
                    <button onClick={handlePrint} className="bg-gray-600 text-white p-2 rounded-lg hover:bg-gray-700 transition flex items-center gap-2">{ICONS.print} طباعة</button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-md mb-6 flex flex-wrap items-center gap-4 no-print">
                <select value={reportType} onChange={e => setReportType(e.target.value)} className="p-2 border rounded-lg bg-white">
                    <option value="attendance_summary">ملخص الحضور والغياب</option>
                    <option value="detailed_hours">تفاصيل ساعات العمل</option>
                    <option value="leaves_report">سجل الإجازات</option>
                    <option value="payroll_report">كشف الرواتب</option>
                    <option value="maintenance_report">تقرير الصيانة والمقبوضات</option>
                    <option value="terminated_employees_report">الموظفون المنتهية خدماتهم</option>
                    <option value="deductions_report">تقرير الخصميات</option>
                    <option value="employee_contracts">حالة عقود الموظفين</option>
                    <option value="manual_attendance">سجلات الدوام اليدوية</option>
                    <option value="clients_report">تقرير العملاء والمهام</option>
                    <option value="employee_profile">بروفايل موظف شامل</option>
                </select>

                <div className="flex items-center gap-2">
                    <label>من:</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-lg" />
                </div>
                <div className="flex items-center gap-2">
                    <label>إلى:</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-lg" />
                </div>

                {reportType !== 'employee_profile' && reportType !== 'clients_report' && (
                    <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="p-2 border rounded-lg bg-white">
                        <option value="all">كل الأقسام</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                )}

                {reportType === 'employee_profile' && (
                    <select value={filterEmployeeId} onChange={e => setFilterEmployeeId(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="p-2 border rounded-lg bg-white">
                        <option value="all" disabled>اختر موظف</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden relative min-h-[200px]">
                {isLoadingReport && (
                    <div className="absolute inset-0 bg-white/80 z-10 flex flex-col items-center justify-center">
                        <span className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-2"></span>
                        <span className="text-primary font-bold">جاري إعداد التقرير والحسابات...</span>
                    </div>
                )}

                {reportType === 'terminated_employees_report' && (
                    <TerminatedEmployeesReport data={reportData} requestSort={requestSort} getSortIndicator={getSortIndicator} />
                )}
                {reportType === 'attendance_summary' && (
                    <AttendanceSummaryReport data={reportData} requestSort={requestSort} getSortIndicator={getSortIndicator} />
                )}
                {reportType === 'detailed_hours' && (
                    <DetailedHoursReport data={reportData} requestSort={requestSort} getSortIndicator={getSortIndicator} />
                )}
                {reportType === 'payroll_report' && (
                    <PayrollReport data={reportData} requestSort={requestSort} getSortIndicator={getSortIndicator} />
                )}
                {reportType === 'maintenance_report' && (
                    <MaintenanceReport data={reportData} requestSort={requestSort} getSortIndicator={getSortIndicator} />
                )}
                {reportType === 'deductions_report' && (
                    <DeductionsReport data={reportData} requestSort={requestSort} getSortIndicator={getSortIndicator} />
                )}
                {reportType === 'leaves_report' && (
                    <LeaveReport data={reportData} requestSort={requestSort} getSortIndicator={getSortIndicator} />
                )}
                {reportType === 'employee_contracts' && (
                    <EmployeeContractsReport data={reportData} requestSort={requestSort} getSortIndicator={getSortIndicator} />
                )}
                {reportType === 'manual_attendance' && (
                    <ManualAttendanceReport data={reportData} requestSort={requestSort} getSortIndicator={getSortIndicator} />
                )}
                {reportType === 'employee_profile' && (
                    <EmployeeProfileReport 
                        data={reportData} 
                        startDate={startDate} 
                        endDate={endDate} 
                        departments={departments} 
                        jobTitles={jobTitles} 
                    />
                )}
                {reportType === 'clients_report' && (
                    <ClientsReport 
                        clients={clients} 
                        clientTasks={clientTasks} 
                        selectedClientId='all' 
                        startDate={startDate} 
                        endDate={endDate} 
                    />
                )}
                
                {!['terminated_employees_report', 'attendance_summary', 'detailed_hours', 'payroll_report', 'maintenance_report', 'deductions_report', 'leaves_report', 'employee_contracts', 'manual_attendance', 'employee_profile', 'clients_report'].includes(reportType) && (
                    <div className="p-10 text-center text-gray-500">
                        التقرير قيد التطوير أو لا توجد بيانات.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reports;