import React, { useState, useEffect } from 'react';
import { Employee, Department, JobTitle, AttendanceRecord, SalaryAdvance, LeaveRequest, Bonus, Deduction, IElectronAPI, PayrollCalculationResult, MaintenanceRecord, MaintenanceStaff, SalaryCurrency } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

// Props interface
interface EmployeeEvaluationProps {
    employees: Employee[];
    departments: Department[];
    jobTitles: JobTitle[];
    attendance: AttendanceRecord[];
    salaryAdvances: SalaryAdvance[];
    leaveRequests: LeaveRequest[];
    bonuses: Bonus[];
    deductions: Deduction[];
    workdays: number[];
    api: IElectronAPI;
    maintenanceRecords: MaintenanceRecord[];
    maintenanceStaff: MaintenanceStaff[];
}

interface EvaluationData {
    attendanceSummary: {
        presentDays: number;
        absentDays: number;
        leaveDays: number;
        lateCount: number;
        totalWorkDays: number;
    };
    payroll: PayrollCalculationResult;
    dailyHoursData: Array<{
        date: string;
        regular: number;
        overtime: number;
    }>;
    maintenanceSummary?: {
        totalCollections: Record<SalaryCurrency, number>;
        recordCount: number;
    } | null;
}

const Gauge: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => {
    const percentage = Math.max(0, Math.min(100, value));
    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg shadow-inner">
            <svg className="w-24 h-24" viewBox="0 0 100 100">
                <circle className="text-gray-200" strokeWidth="10" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" />
                <circle
                    className={color}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="40"
                    cx="50"
                    cy="50"
                    transform="rotate(-90 50 50)"
                />
                <text x="50" y="50" className="font-bold text-xl text-gray-700" textAnchor="middle" dy=".3em">{`${Math.round(percentage)}%`}</text>
            </svg>
            <p className="text-sm font-semibold mt-2 text-gray-600">{label}</p>
        </div>
    );
};


// Component
const EmployeeEvaluation: React.FC<EmployeeEvaluationProps> = ({ employees, departments, jobTitles, attendance, salaryAdvances, leaveRequests, bonuses, deductions, workdays, api, maintenanceRecords, maintenanceStaff }) => {
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
    const [dateRange, setDateRange] = useState(() => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);
        return {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
        };
    });
    const [evaluationData, setEvaluationData] = useState<EvaluationData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

    useEffect(() => {
        if (!selectedEmployeeId) {
            setEvaluationData(null);
            return;
        }

        const calculateData = async () => {
            setIsLoading(true);
            try {
                const employee = employees.find(e => e.id === selectedEmployeeId);
                if (!employee) {
                    setEvaluationData(null);
                    return;
                }

                // Calculate Payroll and hours
                const payroll = await api.payroll.calculate({
                    employeeId: employee.id,
                    startDate: dateRange.start,
                    endDate: dateRange.end
                });

                // Calculate Attendance
                const employeeWorkdaysSet = new Set((employee.workdays && employee.workdays.length > 0) ? employee.workdays : workdays);
                const employeeAttendance = attendance.filter(a => a.employeeId === employee.id && a.date >= dateRange.start && a.date <= dateRange.end);
                const presentDays = new Set(employeeAttendance.map(a => a.date)).size;
                const lateCount = payroll.totalLateMinutes > 0 ? employeeAttendance.filter(a => employee.checkInEndTime && a.checkIn > employee.checkInEndTime).length : 0;
                
                let totalWorkDays = 0;
                for (let d = new Date(dateRange.start); d <= new Date(dateRange.end); d.setDate(d.getDate() + 1)) {
                    if (employeeWorkdaysSet.has(d.getDay())) {
                        totalWorkDays++;
                    }
                }

                const employeeLeaves = leaveRequests.filter(lr => lr.employeeId === employee.id && lr.status === 'Approved' && lr.startDate <= dateRange.end && lr.endDate >= dateRange.start);
                const leaveDaysSet = new Set<string>();
                employeeLeaves.forEach(lr => {
                    for (let d = new Date(lr.startDate); d <= new Date(lr.endDate); d.setDate(d.getDate() + 1)) {
                        const dateStr = d.toISOString().split('T')[0];
                        if (dateStr >= dateRange.start && dateStr <= dateRange.end) {
                             if (employeeWorkdaysSet.has(d.getDay())) {
                                leaveDaysSet.add(dateStr);
                            }
                        }
                    }
                });
                const leaveDays = leaveDaysSet.size;

                const absentDays = Math.max(0, totalWorkDays - presentDays - leaveDays);

                // Prepare data for daily hours chart
                const dailyHoursData: EvaluationData['dailyHoursData'] = [];
                for (let d = new Date(dateRange.start); d <= new Date(dateRange.end); d.setDate(d.getDate() + 1)) {
                    const dateStr = d.toISOString().split('T')[0];
                    const dayAttendance = employeeAttendance.find(a => a.date === dateStr);
                    
                    let hours = 0, overtime = 0, regular = 0;
                    
                    if (dayAttendance && dayAttendance.checkIn && dayAttendance.checkOut) {
                        const duration = (new Date(`${dateStr}T${dayAttendance.checkOut}`).getTime() - new Date(`${dateStr}T${dayAttendance.checkIn}`).getTime()) / 3600000;
                        hours = Math.max(0, duration);
                        overtime = Math.max(0, hours - (employee.agreedDailyHours || 8));
                        regular = hours - overtime;
                    }
                    
                    dailyHoursData.push({
                        date: d.toLocaleDateString('ar-EG', { day: '2-digit' }),
                        regular: parseFloat(regular.toFixed(2)),
                        overtime: parseFloat(overtime.toFixed(2))
                    });
                }
                
                // Calculate Maintenance Summary
                const isMaintenanceStaff = maintenanceStaff.some(s => s.employeeId === employee.id);
                let maintenanceSummary: EvaluationData['maintenanceSummary'] = null;

                if (isMaintenanceStaff) {
                    const records = maintenanceRecords.filter(r => 
                        r.employeeId === employee.id && 
                        r.date >= dateRange.start && 
                        r.date <= dateRange.end
                    );
                    
                    const totals = records.reduce((acc, record) => {
                        if (!acc[record.currency]) {
                            acc[record.currency] = 0;
                        }
                        acc[record.currency] += record.amount;
                        return acc;
                    }, {} as Record<SalaryCurrency, number>);
                    
                    maintenanceSummary = {
                        totalCollections: totals,
                        recordCount: records.length
                    };
                }


                setEvaluationData({
                    attendanceSummary: { presentDays, absentDays, leaveDays, lateCount, totalWorkDays },
                    payroll,
                    dailyHoursData,
                    maintenanceSummary,
                });
            } catch (error) {
                console.error("Failed to calculate evaluation data:", error);
                setEvaluationData(null);
            } finally {
                setIsLoading(false);
            }
        };

        calculateData();
    }, [selectedEmployeeId, dateRange, employees, attendance, leaveRequests, api, workdays, maintenanceRecords, maintenanceStaff]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDateRange(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const commitmentPercentage = evaluationData && evaluationData.attendanceSummary.totalWorkDays > 0
        ? (evaluationData.attendanceSummary.presentDays / evaluationData.attendanceSummary.totalWorkDays) * 100
        : 0;

    const punctualityPercentage = evaluationData && evaluationData.attendanceSummary.presentDays > 0
        ? ((evaluationData.attendanceSummary.presentDays - evaluationData.attendanceSummary.lateCount) / evaluationData.attendanceSummary.presentDays) * 100
        : 100;
        
    const financialChartData = evaluationData ? [
        { name: 'الراتب الأساسي', value: evaluationData.payroll.baseSalary },
        { name: 'العمل الإضافي', value: evaluationData.payroll.overtimePay },
        { name: 'المكافآت', value: evaluationData.payroll.bonusesTotal },
        { name: 'خصم التأخير', value: -evaluationData.payroll.latenessDeductions },
        { name: 'السلف', value: -evaluationData.payroll.advancesTotal },
        { name: 'خصميات أخرى', value: -(evaluationData.payroll.manualDeductionsTotal + evaluationData.payroll.unpaidLeaveDeductions) },
    ].filter(d => d.value !== 0) : [];


    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg border">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">اختر الموظف</label>
                    <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(Number(e.target.value))} className="w-full p-2 border rounded-md bg-white">
                        <option value="">-- قائمة الموظفين --</option>
                        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">من تاريخ</label>
                    <input type="date" name="start" value={dateRange.start} onChange={handleDateChange} className="p-2 border rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">إلى تاريخ</label>
                    <input type="date" name="end" value={dateRange.end} onChange={handleDateChange} className="p-2 border rounded-md" />
                </div>
            </div>

            {isLoading && <div className="flex justify-center items-center h-64"><span className="animate-spin h-5 w-5 border-t-2 border-b-2 border-primary rounded-full"></span><span className="ml-3">جاري تحليل البيانات...</span></div>}
            
            {!isLoading && !selectedEmployee && <div className="text-center text-gray-500 py-20">الرجاء اختيار موظف لعرض تقييم الأداء.</div>}

            {!isLoading && selectedEmployee && evaluationData && (
                <div className="space-y-6">
                    {commitmentPercentage > 95 && (
                        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md" role="alert">
                            <p className="font-bold">اقتراح أداء متميز</p>
                            <p>نظراً للأداء المتميز والالتزام العالي بالدوام (أكثر من 95%)، يُقترح صرف مكافأة لهذا الموظف.</p>
                        </div>
                    )}
                    {/* Employee Info & KPIs */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 flex items-center gap-4 p-4 bg-white rounded-lg shadow">
                            <div className="w-20 h-20 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden border-2 border-primary">
                                {selectedEmployee.photo ? <img src={`data:image/jpeg;base64,${selectedEmployee.photo}`} alt={selectedEmployee.name} className="w-full h-full object-cover" /> : <span className="text-gray-500 text-xs flex items-center justify-center h-full">لا توجد صورة</span>}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-neutral">{selectedEmployee.name}</h3>
                                <p className="text-sm text-gray-600">{jobTitles.find(j => j.id === selectedEmployee.jobTitleId)?.name || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="lg:col-span-2 grid grid-cols-2 gap-6">
                            <Gauge label="الالتزام بالدوام" value={commitmentPercentage} color="text-primary" />
                            <Gauge label="الانضباط بالمواعيد" value={punctualityPercentage} color="text-green-500" />
                        </div>
                    </div>
                    
                    {/* Daily Work Hours Chart */}
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h4 className="text-lg font-semibold mb-4">تحليل ساعات العمل اليومية</h4>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={evaluationData.dailyHoursData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <XAxis dataKey="date" />
                                <YAxis label={{ value: 'ساعات', angle: -90, position: 'insideLeft' }} />
                                <Tooltip formatter={(value: number) => value.toFixed(2)} />
                                <Legend />
                                <ReferenceLine y={selectedEmployee.agreedDailyHours || 8} label={{ value: "الدوام الرسمي", position: "insideTopLeft", fill: "#dc2626" }} stroke="#dc2626" strokeDasharray="3 3" />
                                <Bar dataKey="regular" name="ساعات أساسية" stackId="a" fill="#8884d8" />
                                <Bar dataKey="overtime" name="ساعات إضافية" stackId="a" fill="#82ca9d" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Maintenance Summary */}
                    {evaluationData.maintenanceSummary && (
                        <div className="bg-white p-4 rounded-lg shadow">
                            <h4 className="text-lg font-semibold mb-2">الأداء المالي (صيانة)</h4>
                            {evaluationData.maintenanceSummary.recordCount > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <p className="md:col-span-3 text-sm text-gray-600">
                                        إجمالي المبالغ المستلمة من قبل الموظف خلال الفترة المحددة ({evaluationData.maintenanceSummary.recordCount} عملية):
                                    </p>
                                    {Object.entries(evaluationData.maintenanceSummary.totalCollections).map(([currency, total]) => (
                                        <div key={currency} className="bg-indigo-50 p-3 rounded-lg text-center">
                                            <p className="text-sm text-indigo-800">إجمالي {currency}</p>
                                            {/* FIX: Cast total to number to resolve 'unknown' type from Object.entries */}
                                            <p className="text-2xl font-bold text-indigo-900">{(total as number).toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500">لا توجد مبالغ مستلمة مسجلة لهذا الموظف في الفترة المحددة.</p>
                            )}
                        </div>
                    )}

                    {/* Financial Breakdown */}
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h4 className="text-lg font-semibold mb-4">تحليل مكونات الراتب للفترة</h4>
                         <ResponsiveContainer width="100%" height={250}>
                             <BarChart data={financialChartData} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} />
                                <Tooltip formatter={(value: number) => `${value.toFixed(2)} ${selectedEmployee.salaryCurrency}`} />
                                <Bar dataKey="value" name="القيمة" background={{ fill: '#eee' }}>
                                    {financialChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#22c55e' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Notes */}
                    <div className="bg-white p-4 rounded-lg shadow">
                         <h4 className="text-lg font-semibold mb-2">ملاحظات على الموظف</h4>
                         <p className="text-gray-700 whitespace-pre-wrap">{selectedEmployee.employeeNotes || 'لا توجد ملاحظات مسجلة.'}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeEvaluation;