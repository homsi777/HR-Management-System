
import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Employee, Payment, Department, IElectronAPI, SalaryCurrency, JobTitle, PrintSettings, AttendanceRecord, SalaryAdvance, LeaveRequest, Bonus, Deduction, PayrollCalculationResult, ManufacturingStaff } from '../types';
import { ICONS } from '../constants';
import Modal from './ui/Modal';


interface PayrollProps {
    employees: Employee[];
    attendance: AttendanceRecord[];
    salaryAdvances: SalaryAdvance[];
    leaveRequests: LeaveRequest[];
    bonuses: Bonus[];
    deductions: Deduction[];
    departments: Department[];
    payments: Payment[];
    jobTitles: JobTitle[];
    printSettings: PrintSettings | null;
    api: IElectronAPI;
    setToast: (toast: { message: string; type: 'success' | 'error' }) => void;
    refreshData: () => Promise<void>;
    workdays: number[]; // Still needed for weekly logic
    manufacturingStaff?: ManufacturingStaff[];
}

type PaymentTypeFilter = 'all' | Employee['paymentType'];
type PayrollDataRow = {
    employeeId: number;
    employeeName: string;
    departmentName: string;
    paymentType: Employee['paymentType'];
    salaryCurrency: SalaryCurrency;
    weeks?: Array<{ weekNumber: number; startDate: string; endDate: string; status: 'Paid' | 'Due'; earned: number; totalHoursWorked: number; }>;
    isSettled?: boolean;
    outstandingAdvances: SalaryAdvance[];
} & PayrollCalculationResult;


const getWeeksForMonth = (year: number, month: number) => {
    const weeks = [];
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    let currentDate = new Date(firstDayOfMonth);
    let weekNumber = 1;

    currentDate.setDate(currentDate.getDate() - currentDate.getDay());
    
    while (currentDate <= lastDayOfMonth) {
        const weekStart = new Date(currentDate);
        const weekEnd = new Date(currentDate);
        weekEnd.setDate(weekEnd.getDate() + 6);

        if (weekStart <= lastDayOfMonth && weekEnd >= firstDayOfMonth) {
             weeks.push({
                weekNumber,
                startDate: (weekStart < firstDayOfMonth ? new Date(firstDayOfMonth) : new Date(weekStart)).toISOString().split('T')[0],
                endDate: (weekEnd > lastDayOfMonth ? new Date(lastDayOfMonth) : new Date(weekEnd)).toISOString().split('T')[0],
            });
            weekNumber++;
        }
        currentDate.setDate(currentDate.getDate() + 7);
    }
    return weeks;
};

// Payment Confirmation Modal Component
const PaymentConfirmationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (weekNumber: number | undefined, selectedAdvanceIds: number[]) => void;
    data: PayrollDataRow | null;
    month: number;
    year: number;
    isManufacturing: boolean;
}> = ({ isOpen, onClose, onConfirm, data, month, year, isManufacturing }) => {
    const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
    const [selectedAdvanceIds, setSelectedAdvanceIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (isOpen && data) {
            // Default: Select ALL outstanding advances
            setSelectedAdvanceIds(new Set(data.outstandingAdvances.map(a => a.id)));

            if (data.paymentType === 'weekly' && data.weeks) {
                // Default to the first unpaid week
                const firstDue = data.weeks.find(w => w.status === 'Due');
                if (firstDue) setSelectedWeek(firstDue.weekNumber);
                else setSelectedWeek(data.weeks[0]?.weekNumber || 1);
            } else {
                setSelectedWeek(null);
            }
        }
    }, [isOpen, data]);

    const handleToggleAdvance = (id: number) => {
        const newSet = new Set(selectedAdvanceIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedAdvanceIds(newSet);
    };

    if (!isOpen || !data) return null;

    // Calculate display values based on type
    let baseDisplay = data.baseSalary;
    let periodLabel = `شهر ${month}/${year}`;

    if (data.paymentType === 'weekly' && selectedWeek) {
        const weekData = data.weeks?.find(w => w.weekNumber === selectedWeek);
        if (weekData) {
            baseDisplay = weekData.earned;
            periodLabel = `الأسبوع ${selectedWeek} (من ${weekData.startDate} إلى ${weekData.endDate})`;
        }
    }

    // Calculate dynamic totals based on selection
    const totalSelectedAdvances = data.outstandingAdvances
        .filter(adv => selectedAdvanceIds.has(adv.id))
        .reduce((sum, adv) => sum + adv.amount, 0);

    const otherDeductions = data.totalDeductions; // Already calculated by backend (Lateness + Absence + Manual)
    
    // Net Salary Logic
    // If Manufacturing: Flat Salary - Advances (no other deductions usually)
    // If Weekly: Weekly Amount - Advances - Other Deductions (applied to current payment)
    // If Monthly: Base + Overtime + Bonuses - Other Deductions - Advances
    
    let netDisplay = 0;
    
    if (isManufacturing) {
        netDisplay = data.baseSalary + data.bonusesTotal - totalSelectedAdvances;
    } else if (data.paymentType === 'weekly') {
        // For weekly, we deduct advances/penalties from the selected week's pay
        netDisplay = baseDisplay + data.bonusesTotal + data.overtimePay - otherDeductions - totalSelectedAdvances;
    } else {
        // Monthly / Hourly
        const totalEarnings = data.baseSalary + data.overtimePay + data.bonusesTotal;
        netDisplay = totalEarnings - otherDeductions - totalSelectedAdvances;
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="تأكيد تسليم الراتب" size="large">
            <div className="p-4 space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex justify-between items-center">
                    <div>
                        <h4 className="text-lg font-bold text-blue-900">{data.employeeName}</h4>
                        <p className="text-sm text-blue-700">{data.departmentName} - {data.paymentType === 'weekly' ? 'راتب أسبوعي' : data.paymentType === 'hourly' ? 'نظام ساعات' : 'راتب شهري'}</p>
                    </div>
                    <div className="text-left">
                        <span className="block text-xs text-gray-500">تاريخ الاستحقاق</span>
                        <span className="font-mono font-bold text-lg">{new Date().toLocaleDateString('ar-EG')}</span>
                    </div>
                </div>

                {data.paymentType === 'weekly' && data.weeks && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">اختر الأسبوع المراد تسليمه:</label>
                        <div className="flex gap-2 flex-wrap">
                            {data.weeks.map(week => (
                                <button
                                    key={week.weekNumber}
                                    onClick={() => setSelectedWeek(week.weekNumber)}
                                    disabled={week.status === 'Paid'}
                                    className={`px-4 py-2 rounded-lg border text-sm font-bold transition-all ${
                                        selectedWeek === week.weekNumber 
                                        ? 'bg-primary text-white border-primary shadow-md' 
                                        : week.status === 'Paid'
                                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed decoration-slice'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    الأسبوع {week.weekNumber} {week.status === 'Paid' ? '(مدفوع)' : ''}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Outstanding Advances Selection */}
                {data.outstandingAdvances.length > 0 && (
                    <div className="border rounded-lg p-3 bg-orange-50/50 border-orange-200">
                        <h5 className="font-bold text-orange-800 text-sm mb-2 flex items-center gap-2">
                            {React.cloneElement(ICONS.advances, { className: "h-4 w-4" })}
                            السلف المستحقة (حدد ما تريد خصمه الآن)
                        </h5>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {data.outstandingAdvances.map(adv => (
                                <label key={adv.id} className="flex items-center justify-between bg-white p-2 rounded border border-orange-100 cursor-pointer hover:bg-orange-50">
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedAdvanceIds.has(adv.id)} 
                                            onChange={() => handleToggleAdvance(adv.id)}
                                            className="h-4 w-4 text-orange-600 rounded focus:ring-orange-500"
                                        />
                                        <div className="text-sm">
                                            <span className="font-bold block text-gray-800">{adv.amount} {adv.currency}</span>
                                            <span className="text-xs text-gray-500">{adv.date} - {adv.reason}</span>
                                        </div>
                                    </div>
                                    {selectedAdvanceIds.has(adv.id) ? (
                                        <span className="text-xs font-bold text-red-600">سيتم الخصم</span>
                                    ) : (
                                        <span className="text-xs font-bold text-gray-400">تأجيل</span>
                                    )}
                                </label>
                            ))}
                        </div>
                        <div className="text-left mt-2 text-xs font-bold text-orange-700">
                            مجموع السلف المحددة للخصم: {totalSelectedAdvances.toFixed(2)}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <h5 className="font-bold border-b pb-1 text-green-700">المستحقات</h5>
                        <div className="flex justify-between">
                            <span className="text-gray-600">الراتب الأساسي / المبلغ:</span>
                            <span className="font-mono font-bold">{baseDisplay.toFixed(2)}</span>
                        </div>
                        {!isManufacturing && (
                            <>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">العمل الإضافي:</span>
                                    <span className="font-mono">{data.overtimePay.toFixed(2)}</span>
                                </div>
                            </>
                        )}
                        <div className="flex justify-between">
                            <span className="text-gray-600">المكافآت:</span>
                            <span className="font-mono">{data.bonusesTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h5 className="font-bold border-b pb-1 text-red-700">الاستقطاعات</h5>
                        {!isManufacturing && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">خصميات (تأخير/غياب/يدوي):</span>
                                <span className="font-mono text-red-600">{otherDeductions.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between bg-orange-100 p-1 rounded">
                            <span className="text-gray-800 font-medium">خصم السلف (المحدد):</span>
                            <span className="font-mono text-orange-700 font-bold">{totalSelectedAdvances.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-100 p-4 rounded-lg flex justify-between items-center border-t-2 border-gray-300">
                    <div>
                        <span className="block text-gray-600 text-sm">صافي المبلغ للدفع ({periodLabel})</span>
                        <span className="text-2xl font-bold text-green-700">{netDisplay.toFixed(2)} <span className="text-sm text-gray-500">{data.salaryCurrency}</span></span>
                    </div>
                    <button 
                        onClick={() => onConfirm(selectedWeek || undefined, Array.from(selectedAdvanceIds))}
                        disabled={data.paymentType === 'weekly' && !selectedWeek}
                        className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        تأكيد وتسليم
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// Details Modal (View Only)
const PayrollDetailsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    details: (PayrollDataRow) | null;
    month: number;
    year: number;
    isManufacturing: boolean;
}> = ({ isOpen, onClose, details, month, year, isManufacturing }) => {
    if (!isOpen || !details) return null;

    const earnings: { label: string; value: number; subtext?: string }[] = [
        { label: isManufacturing ? 'الراتب المقطوع' : 'الراتب الأساسي', value: details.baseSalary },
        { label: 'المكافآت', value: details.bonusesTotal },
    ];
    
    if (!isManufacturing) {
        earnings.push({ label: 'عمل إضافي', value: details.overtimePay, subtext: `(${details.totalOvertimeHours.toFixed(2)} ساعة)` });
    }
    
    const totalEarnings = earnings.reduce((sum, item) => sum + item.value, 0);

    const deductions: { label: string; value: number; subtext?: string }[] = [
        { label: 'خصوم يدوية', value: details.manualDeductionsTotal },
        { label: 'السلف (الإجمالي المسجل)', value: details.advancesTotal },
    ];
    
    if (!isManufacturing) {
        deductions.unshift({ label: 'خصم التأخير', value: details.latenessDeductions, subtext: `(${Math.round(details.totalLateMinutes)} دقيقة)` });
        deductions.unshift({ label: 'خصم غياب/إجازة غير مدفوعة', value: details.unpaidLeaveDeductions });
    }
    
    const totalDeductionsValue = deductions.reduce((sum, item) => sum + item.value, 0);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`تفاصيل راتب ${details.employeeName} عن شهر ${month}/${year}`} size="large">
            <div className="p-4 bg-gray-50 rounded-lg">
                {isManufacturing && (
                    <div className="mb-4 bg-orange-100 p-3 rounded-lg border border-orange-200 text-orange-800 text-center font-bold">
                        موظف تصنيع (راتب مقطوع - لا يخضع لخصم التأخير أو الإضافي)
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Earnings */}
                    <div className="md:col-span-2 space-y-4">
                        <h3 className="text-lg font-bold text-green-700 border-b-2 border-green-200 pb-2">المستحقات</h3>
                        <div className="space-y-2">
                            {earnings.map(item => (
                                <div key={item.label} className="flex justify-between items-center text-sm p-2 bg-green-50/50 rounded">
                                    <span className="font-medium text-gray-700">{item.label} {item.subtext && <span className="text-xs text-gray-500">{item.subtext}</span>}</span>
                                    <span className="font-mono font-semibold text-green-800">{item.value.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between items-center text-md font-bold p-2 bg-green-100 rounded">
                            <span>إجمالي المستحقات</span>
                            <span className="font-mono">{totalEarnings.toFixed(2)} {details.salaryCurrency}</span>
                        </div>
                    </div>

                    {/* Deductions */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-red-700 border-b-2 border-red-200 pb-2">الخصميات</h3>
                        <div className="space-y-2">
                            {deductions.map(item => (
                                <div key={item.label} className="flex justify-between items-center text-sm p-2 bg-red-50/50 rounded">
                                     <span className="font-medium text-gray-700">{item.label} {item.subtext && <span className="text-xs text-gray-500">{item.subtext}</span>}</span>
                                    <span className="font-mono font-semibold text-red-800">{item.value.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                         <div className="flex justify-between items-center text-md font-bold p-2 bg-red-100 rounded">
                            <span>إجمالي الخصميات</span>
                            <span className="font-mono">{totalDeductionsValue.toFixed(2)} {details.salaryCurrency}</span>
                        </div>
                    </div>
                </div>

                {/* Net Salary */}
                <div className="mt-6 border-t-2 pt-4 flex justify-between items-center text-xl font-bold p-3 bg-blue-100 rounded-lg">
                    <span className="text-blue-800">صافي الراتب المستحق</span>
                    <span className="font-mono text-blue-900">{details.netSalary.toFixed(2)} {details.salaryCurrency}</span>
                </div>
            </div>
        </Modal>
    );
};


const Payroll: React.FC<PayrollProps> = ({ employees, departments, payments, jobTitles, api, setToast, refreshData, printSettings, attendance, manufacturingStaff = [] }) => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [filterDepartment, setFilterDepartment] = useState<'all' | number>('all');
    const [filterPaymentType, setFilterPaymentType] = useState<PaymentTypeFilter>('all');
    const [filterCurrency, setFilterCurrency] = useState<'all' | SalaryCurrency>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [receiptData, setReceiptData] = useState<any | null>(null);
    const [payrollData, setPayrollData] = useState<PayrollDataRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Modals state
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedPayrollRecord, setSelectedPayrollRecord] = useState<PayrollDataRow | null>(null);
    
    const manufacturingEmployeeIds = useMemo(() => new Set(manufacturingStaff.map(s => s.employeeId)), [manufacturingStaff]);

    // Calculate Totals to be Delivered
    const totalsToBeDelivered = useMemo(() => {
        const totals: Record<string, number> = {};
        payrollData.forEach(p => {
            const currency = p.salaryCurrency;
            if (!totals[currency]) totals[currency] = 0;

            if (p.paymentType === 'weekly' && p.weeks) {
                // Add up all 'Due' weeks
                const dueAmount = p.weeks.reduce((sum, w) => w.status === 'Due' ? sum + w.earned : sum, 0);
                totals[currency] += dueAmount;
            } else if (!p.isSettled) {
                // For Monthly/Hourly, add Net Salary if not settled
                totals[currency] += p.netSalary;
            }
        });
        return totals;
    }, [payrollData]);

    useEffect(() => {
        if (receiptData) {
            const timer = setTimeout(() => {
                const receiptContent = document.querySelector('.printable-receipt');
                if (receiptContent) {
                    api.app.print({ content: receiptContent.innerHTML })
                        .catch(err => console.error("Print failed:", err))
                        .finally(() => setReceiptData(null));
                } else {
                    setToast({ message: 'لم يتم العثور على محتوى الإيصال.', type: 'error' });
                    setReceiptData(null);
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [receiptData, api.app, setToast]);

    const getDepartmentName = (id: number) => departments.find(d => d.id === id)?.name || 'N/A';
    const getJobTitleName = (id: number) => jobTitles.find(j => j.id === id)?.name || 'N/A';

    useEffect(() => {
        const calculatePayroll = async () => {
            setIsLoading(true);

            let filteredEmployees = employees.filter(e => e.status === 'active');
            if (filterDepartment !== 'all') filteredEmployees = filteredEmployees.filter(e => e.departmentId === filterDepartment);
            if (filterPaymentType !== 'all') filteredEmployees = filteredEmployees.filter(e => e.paymentType === filterPaymentType);
            if (filterCurrency !== 'all') filteredEmployees = filteredEmployees.filter(e => e.salaryCurrency === filterCurrency);
            if (searchTerm) filteredEmployees = filteredEmployees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));

            const monthStr = String(month).padStart(2, '0');
            const startDate = `${year}-${monthStr}-01`;
            
            const daysInMonth = new Date(year, month, 0).getDate();
            const endDate = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;
            
            const weeksInMonth = getWeeksForMonth(year, month);
            
            try {
                const payrollPromises = filteredEmployees.map(async (employee) => {
                    const calculated = await api.payroll.calculate({ employeeId: employee.id, startDate, endDate });
                    const employeePayments = payments.filter(p => p.employeeId === employee.id && p.year === year && p.month === month);

                    const record: PayrollDataRow = {
                        ...calculated,
                        employeeId: employee.id,
                        employeeName: employee.name,
                        departmentName: getDepartmentName(employee.departmentId),
                        paymentType: employee.paymentType,
                        salaryCurrency: employee.salaryCurrency || 'SYP',
                        outstandingAdvances: (calculated as any).outstandingAdvances || [],
                    };

                    if (employee.paymentType === 'monthly' || employee.paymentType === 'hourly') {
                        record.isSettled = employeePayments.some(p => p.paymentType === employee.paymentType);
                    } else if (employee.paymentType === 'weekly') {
                        const weeklyAttendance = attendance.filter(att => att.employeeId === employee.id && att.date >= startDate && att.date <= endDate);

                        record.weeks = weeksInMonth.map(week => {
                            const isPaid = employeePayments.some(p => p.weekNumber === week.weekNumber);
                            const weeklyAttForHours = weeklyAttendance.filter(att => att.date >= week.startDate && att.date <= week.endDate);
                            const totalHoursWorked = weeklyAttForHours.reduce((total, att) => {
                                if (att.checkIn && att.checkOut) {
                                    const duration = (new Date(`${att.date}T${att.checkOut}`).getTime() - new Date(`${att.date}T${att.checkIn}`).getTime()) / 3600000;
                                    return total + Math.max(0, duration);
                                }
                                return total;
                            }, 0);

                            const earned = employee.weeklySalary || 0;
                            const finalEarned = isPaid ? (employeePayments.find(p => p.weekNumber === week.weekNumber)?.grossAmount || earned) : earned;
                            return { ...week, status: isPaid ? 'Paid' : 'Due', earned: finalEarned, totalHoursWorked };
                        });
                        
                        const totalUnpaidAmount = record.weeks.filter(w => w.status === 'Due').reduce((sum, w) => sum + w.earned, 0);
                        
                        record.baseSalary = employee.weeklySalary || 0;
                        record.netSalary = totalUnpaidAmount + calculated.overtimePay + calculated.bonusesTotal - calculated.advancesTotal - calculated.totalDeductions;
                    }
                    return record;
                });
                const results = await Promise.all(payrollPromises);
                setPayrollData(results);
            } catch (error) {
                console.error("Error calculating payroll data:", error);
                setToast({ message: 'فشل في حساب الرواتب.', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };

        if (employees.length > 0) {
            calculatePayroll();
        }
    }, [year, month, employees, payments, filterDepartment, filterPaymentType, filterCurrency, searchTerm, api, setToast, attendance, manufacturingStaff]); 
    
    // Initiate delivery flow -> Open Modal
    const handleDeliverClick = (payrollRecord: PayrollDataRow) => {
        setSelectedPayrollRecord(payrollRecord);
        setIsPaymentModalOpen(true);
    };

    // Actual delivery execution
    const handleConfirmDelivery = async (weekNumber: number | undefined, selectedAdvanceIds: number[]) => {
        if (!selectedPayrollRecord) return;

        try {
            const result = await api.payroll.deliverSalary({ 
                employeeId: selectedPayrollRecord.employeeId, 
                year, 
                month, 
                weekNumber, 
                advanceIdsToDeduct: selectedAdvanceIds 
            } as any);
            
            setToast({ message: result.message, type: result.success ? 'success' : 'error' });
            if (result.success) {
                await refreshData();
                setIsPaymentModalOpen(false);
                setSelectedPayrollRecord(null);
            }
        } catch (error: any) {
            setToast({ message: `فشل التسليم: ${error.message}`, type: 'error' });
        }
    };

    const handleShowDetails = (payrollRecord: PayrollDataRow) => {
        setSelectedPayrollRecord(payrollRecord);
        setIsDetailsModalOpen(true);
    };

    const imageUrlToBase64 = async (url: string): Promise<string> => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Error converting image to Base64:", error);
            return ""; 
        }
    };

    const handlePrintReceipt = async (payrollRecord: any, weekNumber: number | null = null) => {
        const employee = employees.find(e => e.id === payrollRecord.employeeId);
        if (!employee) return;
    
        const paymentRecord = payments.find(p => 
            p.employeeId === payrollRecord.employeeId &&
            p.year === year &&
            p.month === month &&
            p.weekNumber === weekNumber
        );
    
        const period = weekNumber
            ? `راتب الأسبوع ${weekNumber} من شهر ${month}/${year}`
            : `راتب شهر ${month}/${year}`;
    
        let baseSalary = payrollRecord.baseSalary;
        let netSalary = payrollRecord.netSalary;
        let advances = payrollRecord.advancesTotal;
        let bonuses = payrollRecord.bonusesTotal;
        let totalDeductions = payrollRecord.totalDeductions;
        let overtimePay = payrollRecord.overtimePay;
    
        if (weekNumber && payrollRecord.weeks) {
            const weekData = payrollRecord.weeks.find((w:any) => w.weekNumber === weekNumber);
            if (weekData) {
                baseSalary = paymentRecord?.grossAmount || payrollRecord.weeklySalary || 0;
                advances = 0;
                bonuses = 0;
                totalDeductions = 0;
                overtimePay = 0;
                netSalary = baseSalary; 
            }
        }
        
        let logoBase64 = '';
        if (printSettings?.companyLogo) {
            logoBase64 = printSettings.companyLogo;
        } else {
            logoBase64 = await imageUrlToBase64('../img/logo.png');
        }

        const data = {
            logoBase64,
            companyName: printSettings?.companyName || "اسم الشركة",
            address: printSettings?.address || "",
            phone: printSettings?.phone || "",
            receiptTitle: `${printSettings?.receiptTitle || 'إيصال'} استلام راتب`,
            template: printSettings?.template || 'template1',
            employeeName: payrollRecord.employeeName,
            employeeCode: employee.employeeCode,
            jobTitleName: getJobTitleName(employee.jobTitleId),
            paymentDate: paymentRecord ? new Date(paymentRecord.paymentDate).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG'),
            period,
            baseSalary,
            overtimePay,
            bonuses,
            totalDeductions,
            advances,
            netSalary,
            salaryCurrency: payrollRecord.salaryCurrency,
        };

        setReceiptData(data);
    };

    const handleExport = () => {
        let dataToExport;
        if (filterPaymentType === 'weekly') {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const weeksInMonth = getWeeksForMonth(year, month);
            const currentWeek = weeksInMonth.find(w => todayStr >= w.startDate && todayStr <= w.endDate);

            if (!currentWeek) {
                setToast({ message: 'لا يمكن تحديد الأسبوع الحالي للتصدير.', type: 'error' });
                return;
            }

            const weeklyPayrollForCurrentWeek = payrollData.map(p => {
                const weekData = p.weeks?.find((w: any) => w.weekNumber === currentWeek.weekNumber);
                return { ...p, weekData };
            }).filter(p => p.weekData);

            dataToExport = weeklyPayrollForCurrentWeek.map(p => ({
                'الموظف': p.employeeName,
                'تاريخ الاستحقاق': p.weekData!.endDate,
                'ساعات العمل': p.weekData!.totalHoursWorked.toFixed(2),
                'الراتب المستحق': `${p.weekData!.earned.toFixed(2)} ${p.salaryCurrency}`,
                'الحالة': p.weekData!.status === 'Paid' ? 'مدفوع' : 'مستحق',
            }));
        } else {
            dataToExport = payrollData.map(p => ({
                'الموظف': p.employeeName,
                'القسم': p.departmentName,
                'الراتب الأساسي': `${(p.baseSalary || 0).toFixed(2)} ${p.salaryCurrency}`,
                'مكافآت': `${(p.bonusesTotal || 0).toFixed(2)} ${p.salaryCurrency}`,
                'عمل إضافي': `${(p.overtimePay || 0).toFixed(2)} ${p.salaryCurrency}`,
                'الخصميات': `${(p.totalDeductions || 0).toFixed(2)} ${p.salaryCurrency}`,
                'السلف': `${p.advancesTotal.toFixed(2)} ${p.salaryCurrency}`,
                'صافي الراتب': `${p.netSalary.toFixed(2)} ${p.salaryCurrency}`,
            }));
        }
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Payroll ${year}-${month}`);
        XLSX.writeFile(wb, `payroll_${year}-${month}_${filterPaymentType}.xlsx`);
    };

    const handlePrint = () => {
        if (window.electronAPI) {
            api.app.print({});
        } else {
            window.print();
        }
    };
    
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    
    const Receipt = ({ data }: { data: any }) => (
        <div className="printable-receipt">
            <div className="receipt-content">
                {data.template === 'template1' && (
                    <>
                        {data.logoBase64 && <img src={data.logoBase64} alt="Logo" style={{ display: 'block', margin: '0 auto 8px auto', maxWidth: '70px', maxHeight: '50px' }} />}
                        <h3 style={{ textAlign: 'center' }}>{data.companyName}</h3>
                        {data.address && <p style={{ textAlign: 'center', fontSize: '7pt' }}>{data.address}</p>}
                        {data.phone && <p style={{ textAlign: 'center', fontSize: '7pt' }}>{data.phone}</p>}
                    </>
                )}
                {data.template === 'template2' && (
                    <>
                        <h3 style={{ textAlign: 'left' }}>{data.companyName}</h3>
                        {data.address && <p style={{ textAlign: 'left', fontSize: '7pt' }}>{data.address}</p>}
                        {data.phone && <p style={{ textAlign: 'left', fontSize: '7pt' }}>{data.phone}</p>}
                    </>
                )}
                 {data.template === 'template3' && (
                    <>
                        <h3 style={{ textAlign: 'right' }}>{data.companyName}</h3>
                        {data.address && <p style={{ textAlign: 'right', fontSize: '7pt' }}>{data.address}</p>}
                        {data.phone && <p style={{ textAlign: 'right', fontSize: '7pt' }}>{data.phone}</p>}
                    </>
                )}
                <p style={{textAlign: 'center', fontSize: '8pt', fontWeight: 'bold', margin: '5px 0'}}>{data.receiptTitle}</p>
                <div className="line"></div>
                <div className="details">
                    <div><span>الموظف:</span><span>{data.employeeName}</span></div>
                    <div><span>الرقم الوظيفي:</span><span>{data.employeeCode}</span></div>
                    <div><span>المسمى الوظيفي:</span><span>{data.jobTitleName}</span></div>
                    <div><span>تاريخ الدفع:</span><span>{data.paymentDate}</span></div>
                    <div><span>عن فترة:</span><span>{data.period}</span></div>
                </div>
                <div className="line"></div>
                <div className="details">
                    <div><span>الراتب الأساسي:</span><span>{data.baseSalary.toFixed(2)}</span></div>
                    <div><span>مكافآت:</span><span>{data.bonuses.toFixed(2)}</span></div>
                    <div><span>مكافأة إضافي:</span><span>{data.overtimePay.toFixed(2)}</span></div>
                    <div><span>خصم سلف:</span><span>- {data.advances.toFixed(2)}</span></div>
                    <div><span>الخصميات:</span><span>- {data.totalDeductions.toFixed(2)}</span></div>
                </div>
                <div className="line"></div>
                <div className="details total">
                    <div><span>صافي الراتب:</span><span>{data.netSalary.toFixed(2)} {data.salaryCurrency}</span></div>
                </div>
                <div className="signature">
                    <p>توقيع المستلم:</p>
                    <br/>
                    <p>.............................</p>
                </div>
            </div>
        </div>
    );

    const renderTable = () => {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center h-64">
                    <div className="flex items-center gap-2 text-gray-500">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>جاري حساب الرواتب...</span>
                    </div>
                </div>
            );
        }

        return (
            <table className="min-w-full text-right">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="py-3 px-4 font-medium">الموظف</th>
                        <th className="py-3 px-4 font-medium">الراتب الأساسي/المستحق</th>
                        <th className="py-3 px-4 font-medium">مكافآت</th>
                        <th className="py-3 px-4 font-medium">عمل إضافي</th>
                        <th className="py-3 px-4 font-medium">الخصميات</th>
                        <th className="py-3 px-4 font-medium">السلف</th>
                        <th className="py-3 px-4 font-medium">صافي الراتب</th>
                        <th className="py-3 px-4 font-medium no-print">إجراءات</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {payrollData.map(p => {
                         const isManufacturing = manufacturingEmployeeIds.has(p.employeeId);
                         
                         return (
                         <React.Fragment key={p.employeeId}>
                            <tr className={isManufacturing ? 'bg-orange-50' : ''}>
                                <td className="py-4 px-4">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleShowDetails(p)} className="font-medium text-primary hover:underline">{p.employeeName}</button>
                                            {isManufacturing && <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-bold">راتب مقطوع</span>}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">{p.paymentType === 'monthly' ? 'شهري' : p.paymentType === 'weekly' ? 'أسبوعي' : `ساعات (${(p.totalWorkedHours || 0).toFixed(1)})`}</p>
                                    </div>
                                </td>
                                <td className="py-4 px-4">{`${(p.baseSalary || 0).toFixed(2)} ${p.salaryCurrency}`}</td>
                                <td className="py-4 px-4 text-green-600">{`${(p.bonusesTotal || 0).toFixed(2)} ${p.salaryCurrency}`}</td>
                                <td className="py-4 px-4 text-green-600">
                                    {isManufacturing ? <span className="text-gray-400 text-xs">-</span> : `${(p.overtimePay || 0).toFixed(2)} ${p.salaryCurrency}`}
                                </td>
                                <td className="py-4 px-4 text-red-600">{`${(p.totalDeductions || 0).toFixed(2)} ${p.salaryCurrency}`}</td>
                                <td className="py-4 px-4 text-orange-600">{`${p.advancesTotal.toFixed(2)} ${p.salaryCurrency}`}</td>
                                <td className="py-4 px-4 font-bold text-green-700">{`${p.netSalary.toFixed(2)} ${p.salaryCurrency}`}</td>
                                <td className="py-4 px-4 no-print">
                                    <div className="flex items-center gap-2">
                                        {/* Unified Deliver Button for All Types */}
                                        {p.isSettled ? (
                                            <button className="px-3 py-1 rounded-lg text-sm bg-gray-200 text-gray-600 cursor-not-allowed" disabled>
                                                تم التسليم
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleDeliverClick(p)}
                                                className="px-3 py-1 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700 transition"
                                            > 
                                                تسليم
                                            </button>
                                        )}
                                        
                                        {/* Print Buttons */}
                                        {p.paymentType === 'weekly' && p.weeks ? (
                                            // For weekly, check if ANY week is paid to show print
                                            p.weeks.some((w: any) => w.status === 'Paid') && (
                                                <div className="relative group">
                                                    <button className="bg-gray-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-gray-600 flex items-center gap-1">
                                                        طباعة 
                                                        <span className="text-[10px]">▼</span>
                                                    </button>
                                                    <div className="absolute left-0 mt-1 w-32 bg-white border rounded shadow-lg z-10 hidden group-hover:block">
                                                        {p.weeks.filter((w: any) => w.status === 'Paid').map((w: any) => (
                                                            <button 
                                                                key={w.weekNumber} 
                                                                onClick={() => handlePrintReceipt(p, w.weekNumber)}
                                                                className="block w-full text-right px-3 py-2 text-sm hover:bg-gray-100"
                                                            >
                                                                أسبوع {w.weekNumber}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        ) : (
                                            // Monthly/Hourly Print
                                            p.isSettled && (
                                                <button onClick={() => handlePrintReceipt(p)} className="bg-gray-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-gray-600">
                                                    طباعة
                                                </button>
                                            )
                                        )}
                                    </div>
                                </td>
                            </tr>
                        </React.Fragment>
                    )})}
                </tbody>
            </table>
        );
    };

    return (
        <div className={`p-6 ${receiptData ? 'is-printing' : ''}`}>
            {/* Header Area */}
            <div className="flex justify-between items-start mb-6 no-print">
                 <div>
                    <h2 className="text-2xl font-bold text-neutral">كشف الرواتب</h2>
                    <p className="text-gray-500 text-sm mt-1">إدارة رواتب الموظفين الشهرية والأسبوعية</p>
                 </div>
                 <div className="flex items-center gap-2">
                    <button onClick={handleExport} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-sm font-medium">{ICONS.export} تصدير Excel</button>
                    <button onClick={handlePrint} className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition flex items-center gap-2 shadow-sm font-medium">{ICONS.print} طباعة القائمة</button>
                 </div>
            </div>

            {/* Total to be Delivered Summary */}
            <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-4 rounded-xl shadow-lg mb-6 text-white no-print">
                <h3 className="text-lg font-bold mb-3 border-b border-white/20 pb-2">مجموع المبالغ المستحقة للتسليم</h3>
                <div className="flex flex-wrap gap-4">
                    {Object.keys(totalsToBeDelivered).length > 0 ? (
                        Object.entries(totalsToBeDelivered).map(([currency, amount]) => (
                            <div key={currency} className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/30 flex items-center gap-2">
                                <span className="font-bold text-xl">{amount.toFixed(2)}</span>
                                <span className="text-sm opacity-90">{currency}</span>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm opacity-80">لا توجد رواتب مستحقة غير مدفوعة حالياً.</p>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-md mb-6 flex flex-wrap items-center gap-4 no-print border border-gray-100">
                <select value={year} onChange={e => setYear(Number(e.target.value))} className="p-2 border rounded-lg bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={month} onChange={e => setMonth(Number(e.target.value))} className="p-2 border rounded-lg bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="p-2 border rounded-lg bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                    <option value="all">كل الأقسام</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                 <select value={filterPaymentType} onChange={e => setFilterPaymentType(e.target.value as PaymentTypeFilter)} className="p-2 border rounded-lg bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                    <option value="all">كل الأنواع</option>
                    <option value="monthly">شهري</option>
                    <option value="weekly">أسبوعي</option>
                    <option value="hourly">ساعات</option>
                </select>
                <select value={filterCurrency} onChange={e => setFilterCurrency(e.target.value as 'all' | SalaryCurrency)} className="p-2 border rounded-lg bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                    <option value="all">كل العملات</option>
                    <option value="SYP">ل.س</option>
                    <option value="USD">$</option>
                    <option value="TRY">ل.ت</option>
                </select>
                <input type="text" placeholder="بحث باسم الموظف..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 border rounded-lg bg-white flex-grow focus:ring-2 focus:ring-primary focus:outline-none"/>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-xl shadow-md overflow-x-auto border border-gray-100">
                {renderTable()}
            </div>
            
             <PayrollDetailsModal 
                isOpen={isDetailsModalOpen} 
                onClose={() => setIsDetailsModalOpen(false)}
                details={selectedPayrollRecord}
                month={month}
                year={year}
                isManufacturing={manufacturingEmployeeIds.has(selectedPayrollRecord?.employeeId || 0)}
            />

            <PaymentConfirmationModal 
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onConfirm={handleConfirmDelivery}
                data={selectedPayrollRecord}
                month={month}
                year={year}
                isManufacturing={manufacturingEmployeeIds.has(selectedPayrollRecord?.employeeId || 0)}
            />

            {receiptData && <Receipt data={receiptData} />}
        </div>
    );
};

export default Payroll;
