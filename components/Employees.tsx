import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import Webcam from 'react-webcam';
import { Employee, Department, Branch, JobTitle, Device, IElectronAPI, ScannedIDData, SalaryCurrency, LeaveRequest, SMSMessage, SMSPriority, AttendanceRecord, SalaryAdvance, Bonus, Deduction, MaintenanceRecord, MaintenanceStaff, PayrollCalculationResult } from '../types';
import Modal from './ui/Modal';
import { ICONS } from '../constants';
import EmployeeEvaluation from './EmployeeEvaluation';

type SortableKeys = keyof Employee | 'jobTitleName' | 'departmentName' | 'branchName';

interface EmployeesProps {
    employees: Employee[];
    departments: Department[];
    branches: Branch[];
    jobTitles: JobTitle[];
    devices: Device[];
    workdays: number[];
    leaveRequests: LeaveRequest[];
    attendance: AttendanceRecord[];
    salaryAdvances: SalaryAdvance[];
    bonuses: Bonus[];
    deductions: Deduction[];
    maintenanceRecords: MaintenanceRecord[];
    maintenanceStaff: MaintenanceStaff[];
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
    api: IElectronAPI;
}

const initialFormData: Omit<Employee, 'id'> = {
    employeeCode: '', name: '', jobTitleId: 0, departmentId: 0,
    branchId: 0, hireDate: '', status: 'active', phone: '',
    email: '', address: '', biometricId: '', nationalId: '',
    paymentType: 'hourly', monthlySalary: 0, weeklySalary: 0, agreedDailyHours: 8,
    hourlyRate: 0, overtimeRate: 0, latenessDeductionRate: 0, assignedDeviceIds: [], workdays: [],
    calculateSalaryBy30Days: false,
    checkInStartTime: '08:00',
    checkInEndTime: '09:00',
    checkOutStartTime: '17:00',
    checkOutEndTime: '18:00',
    photo: '',
    idPhotoFront: '',
    idPhotoBack: '',
    checkInType: 'fingerprint',
    previousJobTitle: '',
    employeeNotes: '',
    salaryCurrency: 'SYP',
    cvFile: '',
    cvFileName: '',
    cvFileType: '',
    employmentType: 'freelance',
    contractStartDate: '',
    contractEndDate: '',
    contractFile: '',
    contractFileName: '',
    contractFileType: '',
    source: 'manual'
};

const initialTerminationData = {
    employeeId: '',
    terminationDate: new Date().toISOString().split('T')[0],
    reason: '',
    notes: ''
};

const weekDays = [
    { id: 0, name: 'الأحد' }, { id: 1, name: 'الاثنين' }, { id: 2, name: 'الثلاثاء' },
    { id: 3, name: 'الأربعاء' }, { id: 4, name: 'الخميس' }, { id: 5, name: 'الجمعة' },
    { id: 6, name: 'السبت' },
];

const checkInTypeTranslations: Record<NonNullable<Employee['checkInType']>, string> = {
    'nfc': 'بطاقة NFC',
    'fingerprint': 'بصمة اصبع',
    'face': 'بصمة وجه'
};

const salaryCurrencyTranslations: Record<SalaryCurrency, string> = {
    'SYP': 'ليرة سوري',
    'USD': 'دولار أمريكي',
    'TRY': 'ليرة تركي'
};

const Employees: React.FC<EmployeesProps> = ({ employees, departments, branches, jobTitles, devices, workdays, leaveRequests, attendance, salaryAdvances, bonuses, deductions, maintenanceRecords, maintenanceStaff, refreshData, setToast, api }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedUploadDeviceId, setSelectedUploadDeviceId] = useState<number | ''>('');
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [formData, setFormData] = useState<Omit<Employee, 'id'>>(initialFormData);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | Employee['status']>('all');
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending' });
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [employeeToAssign, setEmployeeToAssign] = useState<Employee | null>(null);
    const [selectedDevices, setSelectedDevices] = useState<Set<number>>(new Set());
    
    // Termination Modal State
    const [isTerminationModalOpen, setIsTerminationModalOpen] = useState(false);
    const [terminationData, setTerminationData] = useState(initialTerminationData);
    const [settlementData, setSettlementData] = useState<PayrollCalculationResult | null>(null);
    const [showSettlementReview, setShowSettlementReview] = useState(false);
    const [receiptData, setReceiptData] = useState<any | null>(null);
    
    // SMS Modal State
    const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
    const [smsTarget, setSmsTarget] = useState<{name: string, phone: string} | null>(null);

    // Evaluation Modal State
    const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);

    // Camera state
    const webcamRef = useRef<Webcam>(null);
    const personalPhotoInputRef = useRef<HTMLInputElement>(null);
    const idPhotoFrontInputRef = useRef<HTMLInputElement>(null);
    const idPhotoBackInputRef = useRef<HTMLInputElement>(null);
    const cvFileInputRef = useRef<HTMLInputElement>(null);
    const contractFileInputRef = useRef<HTMLInputElement>(null);
    const [activeCameraFor, setActiveCameraFor] = useState<null | 'personal' | 'idFront' | 'idBack'>(null);

    // ID Scanner State
    const [inputMethod, setInputMethod] = useState<'manual' | 'scanner'>('manual');
    const [isScanningId, setIsScanningId] = useState(false);
    const scannerSettingsRef = useRef({ port: '', baudRate: 19200 });

     useEffect(() => {
        // Fetch scanner settings when component mounts
        const fetchScannerSettings = async () => {
            const portSetting = await api.db.getSettings('scannerComPort');
            const baudRateSetting = await api.db.getSettings('scannerBaudRate');
            if (portSetting) scannerSettingsRef.current.port = JSON.parse(portSetting.value);
            if (baudRateSetting) scannerSettingsRef.current.baudRate = JSON.parse(baudRateSetting.value);
        };
        fetchScannerSettings();
    }, [api.db]);

    useEffect(() => {
        if (!isScanningId || !isModalOpen) return;

        const handleScanData = (data: ScannedIDData) => {
            setToast({ message: 'تم استلام البيانات، جاري المعالجة...', type: 'success' });
            setFormData(prev => ({
                ...prev,
                name: data.full_name,
                biometricId: data.national_id,
                nationalId: data.national_id
            }));
            setIsScanningId(false); // Stop listening
            setInputMethod('manual'); // Switch back to manual for review/editing
        };

        const handleScanError = ({ message }: { message: string }) => {
            setToast({ message, type: 'error' });
            setIsScanningId(false);
            setInputMethod('manual'); // Also revert on error
        };

        api.scanner.onScanData(handleScanData);
        api.scanner.onScanError(handleScanError);
        api.scanner.startListener(scannerSettingsRef.current);
        
        return () => {
            api.scanner.stopListener();
            api.scanner.removeListeners();
        };
    }, [isScanningId, isModalOpen, api.scanner, setToast]);

    // Print Receipt Effect
    useEffect(() => {
        if (receiptData) {
            const timer = setTimeout(() => {
                const receiptContent = document.querySelector('.printable-termination-receipt');
                if (receiptContent) {
                    api.app.print({ content: receiptContent.innerHTML })
                        .catch(err => console.error("Print failed:", err))
                        .finally(() => setReceiptData(null));
                } else {
                    console.error("Could not find printable termination receipt content.");
                    setReceiptData(null);
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [receiptData, api.app]);


    useEffect(() => {
        if (employeeToAssign) {
            setSelectedDevices(new Set(employeeToAssign.assignedDeviceIds || []));
        }
    }, [employeeToAssign]);
    
    // When the modal closes, ensure the camera is turned off.
    useEffect(() => {
        if (!isModalOpen) {
            setActiveCameraFor(null);
            setIsScanningId(false); // Stop scanning when modal closes
            setInputMethod('manual'); // Reset input method
            setErrors({}); // Clear validation errors
        }
    }, [isModalOpen]);

    // Automatically calculate hourly rate for salaried employees
    useEffect(() => {
        const { paymentType, monthlySalary, weeklySalary, agreedDailyHours, workdays } = formData;
        
        if ((paymentType === 'monthly' || paymentType === 'weekly') && agreedDailyHours > 0 && workdays && workdays.length > 0) {
            let calculatedRate = 0;
            
            if (paymentType === 'monthly' && monthlySalary > 0) {
                const weeksInMonth = 4.333; // An approximation for calculation
                const workdaysPerMonth = workdays.length * weeksInMonth;
                if (workdaysPerMonth > 0) {
                    calculatedRate = monthlySalary / workdaysPerMonth / agreedDailyHours;
                }
            } else if (paymentType === 'weekly' && weeklySalary > 0) {
                calculatedRate = weeklySalary / workdays.length / agreedDailyHours;
            }
    
            const newHourlyRate = parseFloat(calculatedRate.toFixed(2));
            if (!isNaN(newHourlyRate) && newHourlyRate >= 0) {
                if (newHourlyRate !== formData.hourlyRate) {
                     setFormData(prev => ({
                        ...prev,
                        hourlyRate: newHourlyRate
                    }));
                }
            }
        }
    }, [formData.paymentType, formData.monthlySalary, formData.weeklySalary, formData.agreedDailyHours, formData.workdays]);

    // Automatically calculate checkout start time based on work hours and check-in time
    useEffect(() => {
        const { agreedDailyHours, checkInStartTime } = formData;
    
        if (agreedDailyHours > 0 && checkInStartTime && /^\d{2}:\d{2}$/.test(checkInStartTime)) {
            try {
                const [startHours, startMinutes] = checkInStartTime.split(':').map(Number);
                
                const startTime = new Date();
                startTime.setHours(startHours, startMinutes, 0, 0);
    
                const hoursToAdd = Math.floor(agreedDailyHours);
                const minutesToAdd = Math.round((agreedDailyHours % 1) * 60);
    
                startTime.setHours(startTime.getHours() + hoursToAdd);
                startTime.setMinutes(startTime.getMinutes() + minutesToAdd);
    
                const endHours = String(startTime.getHours()).padStart(2, '0');
                const endMinutes = String(startTime.getMinutes()).padStart(2, '0');
    
                const newCheckOutStartTime = `${endHours}:${endMinutes}`;
    
                if (newCheckOutStartTime !== formData.checkOutStartTime) {
                    setFormData(prev => ({
                        ...prev,
                        checkOutStartTime: newCheckOutStartTime
                    }));
                }
            } catch (error) {
                console.error("Error calculating checkout time:", error);
            }
        }
    }, [formData.agreedDailyHours, formData.checkInStartTime]);


    const capturePhoto = React.useCallback(() => {
        if (webcamRef.current && activeCameraFor) {
            const imageSrc = webcamRef.current.getScreenshot();
            if (imageSrc) {
                const base64Data = imageSrc.split(',')[1];
                const fieldToUpdate = 
                    activeCameraFor === 'personal' ? 'photo' :
                    activeCameraFor === 'idFront' ? 'idPhotoFront' :
                    'idPhotoBack';
                setFormData(prev => ({ ...prev, [fieldToUpdate]: base64Data }));
            }
        }
        setActiveCameraFor(null); // Turn off camera view after capturing
    }, [webcamRef, activeCameraFor]);


    const handleOpenAssignModal = (employee: Employee) => {
        setEmployeeToAssign(employee);
        setIsAssignModalOpen(true);
    };

    const handleOpenTerminationModal = () => {
        const firstActiveEmployee = employees.find(e => e.status === 'active');
        setTerminationData({ ...initialTerminationData, employeeId: firstActiveEmployee ? String(firstActiveEmployee.id) : '' });
        setShowSettlementReview(false);
        setSettlementData(null);
        setIsTerminationModalOpen(true);
    };

    const handleCalculateSettlement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!terminationData.employeeId || !terminationData.terminationDate) {
            setToast({ message: 'الرجاء اختيار الموظف وتاريخ الإنهاء.', type: 'error' });
            return;
        }

        const terminationDate = new Date(terminationData.terminationDate);
        // Assuming monthly cycle starts from the 1st
        const startDate = new Date(terminationDate.getFullYear(), terminationDate.getMonth(), 1).toISOString().split('T')[0];
        
        try {
            const result = await api.payroll.calculate({
                employeeId: Number(terminationData.employeeId),
                startDate: startDate,
                endDate: terminationData.terminationDate
            });
            setSettlementData(result);
            setShowSettlementReview(true);
        } catch (error: any) {
            setToast({ message: `فشل حساب المخالصة: ${error.message}`, type: 'error' });
        }
    };

    const handleConfirmTermination = async () => {
        if (!terminationData.employeeId || !terminationData.reason) {
            setToast({ message: 'الرجاء التأكد من البيانات.', type: 'error' });
            return;
        }

        const result = await api.app.terminateEmployee({
            ...terminationData,
            employeeId: Number(terminationData.employeeId),
            financialData: settlementData // Pass the calculated settlement data to be stored
        });

        setToast({ message: result.message, type: result.success ? 'success' : 'error' });
        if (result.success) {
            await refreshData();
            setIsTerminationModalOpen(false);
        }
    };

    const handlePrintSettlement = async () => {
        if (!settlementData || !terminationData.employeeId) return;
        
        const employee = employees.find(e => e.id === Number(terminationData.employeeId));
        if (!employee) return;

        const companyNameSetting = await api.db.getSettings('projectName');
        const companyName = companyNameSetting ? JSON.parse(companyNameSetting.value) : 'اسم الشركة';

        const printData = {
            companyName,
            employeeName: employee.name,
            terminationDate: terminationData.terminationDate,
            reason: terminationData.reason,
            baseSalary: settlementData.baseSalary,
            additions: settlementData.overtimePay + settlementData.bonusesTotal,
            deductions: settlementData.totalDeductions,
            advances: settlementData.advancesTotal,
            netAmount: settlementData.netSalary,
            currency: employee.salaryCurrency
        };
        
        setReceiptData(printData);
    };

    const handleOpenSmsModal = (employee: Employee) => {
        if (!employee.phone) {
            setToast({ message: 'لا يوجد رقم هاتف مسجل لهذا الموظف.', type: 'error' });
            return;
        }
        setSmsTarget({ name: employee.name, phone: employee.phone });
        setIsSmsModalOpen(true);
    };

    const handleDeviceSelection = (deviceId: number) => {
        const newSelection = new Set(selectedDevices);
        if (newSelection.has(deviceId)) {
            newSelection.delete(deviceId);
        } else {
            newSelection.add(deviceId);
        }
        setSelectedDevices(newSelection);
    };

    const handleAssignDevicesSave = async () => {
        if (!employeeToAssign) return;
        
        await api.db.update('employees', employeeToAssign.id, { 
            assignedDeviceIds: Array.from(selectedDevices) 
        });
        
        await refreshData();
        setIsAssignModalOpen(false);
        setToast({ message: `تم تحديث أجهزة الموظف ${employeeToAssign.name}.`, type: 'success' });
    };

    const getRelatedName = (id: number, type: 'job' | 'dept' | 'branch') => {
        if (type === 'job') return jobTitles.find(j => j.id === id)?.name || 'N/A';
        if (type === 'dept') return departments.find(d => d.id === id)?.name || 'N/A';
        if (type === 'branch') return branches.find(b => b.id === id)?.name || 'N/A';
        return 'N/A';
    };

    const todayStr = new Date().toISOString().split('T')[0];
    const onLeaveTodayIds = useMemo(() => 
        new Set(
            leaveRequests
                .filter(lr => lr.status === 'Approved' && todayStr >= lr.startDate && todayStr <= lr.endDate)
                .map(lr => lr.employeeId)
        ), 
        [leaveRequests, todayStr]
    );

    const filteredAndSortedEmployees = useMemo(() => {
        let filtered = employees.filter(emp => {
            const searchMatch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || (emp.email && emp.email.toLowerCase().includes(searchTerm.toLowerCase()));
            if (!searchMatch) return false;

            // Determine current effective status
            const isCurrentlyOnLeave = onLeaveTodayIds.has(emp.id);
            const effectiveStatus = isCurrentlyOnLeave ? 'on_leave' : emp.status;

            if (filterStatus === 'all') return true;
            
            return effectiveStatus === filterStatus;
        });
        if (sortConfig) {
            filtered.sort((a, b) => {
                let aValue: any, bValue: any;
                switch (sortConfig.key) {
                    case 'jobTitleName': aValue = getRelatedName(a.jobTitleId, 'job'); bValue = getRelatedName(b.jobTitleId, 'job'); break;
                    case 'departmentName': aValue = getRelatedName(a.departmentId, 'dept'); bValue = getRelatedName(b.departmentId, 'dept'); break;
                    case 'branchName': aValue = getRelatedName(a.branchId, 'branch'); bValue = getRelatedName(b.branchId, 'branch'); break;
                    default: aValue = a[sortConfig.key as keyof Employee]; bValue = b[sortConfig.key as keyof Employee];
                }
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [employees, searchTerm, filterStatus, sortConfig, jobTitles, departments, branches, onLeaveTodayIds]);
    
    const requestSort = (key: SortableKeys) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig?.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: SortableKeys) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const isNumeric = ['jobTitleId', 'departmentId', 'branchId', 'agreedDailyHours', 'hourlyRate', 'overtimeRate', 'monthlySalary', 'weeklySalary', 'latenessDeductionRate'].includes(name);
        
        let parsedValue: string | number = value;
        if (isNumeric) {
            if (['jobTitleId', 'departmentId', 'branchId'].includes(name)) {
                parsedValue = Number(value);
            } else {
                const floatVal = parseFloat(value);
                // Handle empty string gracefully by setting to 0 (or allow string until blur if necessary)
                // For now, prevent NaN
                parsedValue = isNaN(floatVal) ? 0 : floatVal;
            }
        }
        setFormData(prev => ({ ...prev, [name]: parsedValue }));
    };
    
    const handleWorkdayChange = (dayId: number) => {
        setFormData(prev => {
            const currentWorkdays = new Set(prev.workdays || []);
            if (currentWorkdays.has(dayId)) {
                currentWorkdays.delete(dayId);
            } else {
                currentWorkdays.add(dayId);
            }
            return { ...prev, workdays: Array.from(currentWorkdays).sort() };
        });
    };
    
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'photo' | 'idPhotoFront' | 'idPhotoBack') => {
        const file = e.target.files?.[0];
        // Reset input value to allow re-selecting the same file, a robust practice.
        e.target.value = '';

        if (file) {
            if (!file.type.startsWith('image/')) {
                setToast({ message: 'الرجاء اختيار ملف صورة صالح.', type: 'error' });
                return;
            }
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                setToast({ message: 'حجم الصورة كبير جداً. الحد الأقصى 2 ميجابايت.', type: 'error' });
                return;
            }
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                const dataUrl = loadEvent.target?.result as string;
                if (dataUrl) {
                    const base64Data = dataUrl.split(',')[1];
                    setFormData(prev => ({ ...prev, [fieldName]: base64Data }));
                }
            };
            reader.onerror = () => {
                setToast({ message: 'فشل في قراءة ملف الصورة.', type: 'error' });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'cv' | 'contract') => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setToast({ message: 'حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت.', type: 'error' });
                return;
            }
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                const dataUrl = loadEvent.target?.result as string;
                if (dataUrl) {
                    const base64Data = dataUrl.split(',')[1];
                    if (fileType === 'cv') {
                        setFormData(prev => ({
                            ...prev,
                            cvFile: base64Data,
                            cvFileName: file.name,
                            cvFileType: file.type
                        }));
                    } else {
                        setFormData(prev => ({
                            ...prev,
                            contractFile: base64Data,
                            contractFileName: file.name,
                            contractFileType: file.type
                        }));
                    }
                }
            };
            reader.onerror = () => {
                setToast({ message: 'فشل في قراءة الملف.', type: 'error' });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEdit = (employee: Employee) => {
        setSelectedEmployee(employee);
        const employeeWorkdays = employee.workdays && employee.workdays.length > 0 ? employee.workdays : workdays;
        const { id, ...employeeData } = employee; // Destructure to avoid passing 'id'
        setFormData({
            ...initialFormData,
            ...employeeData,
            workdays: employeeWorkdays
        });
        setInputMethod('manual');
        setErrors({});
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذا الموظف؟ سيتم حذف جميع السجلات المتعلقة به.')) {
            try {
                await api.db.delete('employees', id);
                await refreshData();
                setToast({ message: 'تم حذف الموظف بنجاح.', type: 'success' });
            } catch (error: any) {
                 console.error("Failed to delete employee:", error);
                 setToast({ message: `فشل حذف الموظف: ${error.message}`, type: 'error' });
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // --- Validation ---
        const newErrors: { [key: string]: string } = {};
        const employeeCode = String(formData.employeeCode || '').trim();
        const biometricId = String(formData.biometricId || '').trim();

        if (employeeCode) {
            const existing = employees.find(emp => emp.employeeCode === employeeCode && emp.id !== selectedEmployee?.id);
            if (existing) {
                newErrors.employeeCode = `هذا الرقم مستخدم بالفعل للموظف ${existing.name}.`;
            }
        }
        if (biometricId) {
            const existing = employees.find(emp => emp.biometricId === biometricId && emp.id !== selectedEmployee?.id);
            if (existing) {
                newErrors.biometricId = `معرف البصمة مستخدم بالفعل للموظف ${existing.name}.`;
            }
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) {
            setToast({ message: 'الرجاء إصلاح الأخطاء في النموذج.', type: 'error' });
            return;
        }

        // --- Submission ---
        let dataToSubmit: Partial<Omit<Employee, 'id'>> = { ...formData, biometricId, employeeCode };

        // Reset unused payment fields for data consistency
        if (dataToSubmit.paymentType === 'monthly') {
            dataToSubmit = { ...dataToSubmit, weeklySalary: 0 };
        } else if (dataToSubmit.paymentType === 'weekly') {
             dataToSubmit = { ...dataToSubmit, monthlySalary: 0 };
        } else { // 'hourly'
            dataToSubmit = { ...dataToSubmit, monthlySalary: 0, weeklySalary: 0 };
        }

        // Clean contract fields if not a contract employee
        if (dataToSubmit.employmentType !== 'contract') {
            dataToSubmit = { ...dataToSubmit, contractStartDate: undefined, contractEndDate: undefined, contractFile: undefined, contractFileName: undefined, contractFileType: undefined };
        }

        if (selectedEmployee) {
            await api.db.update('employees', selectedEmployee.id, dataToSubmit);
        } else {
            await api.db.insert('employees', dataToSubmit);
        }
        await refreshData();
        setIsModalOpen(false);
    };

    const handleExport = () => {
        const dataToExport = filteredAndSortedEmployees.map(emp => ({
            'الاسم': emp.name, 'المسمى الوظيفي': getRelatedName(emp.jobTitleId, 'job'),
            'القسم': getRelatedName(emp.departmentId, 'dept'), 'الفرع': getRelatedName(emp.branchId, 'branch'),
            'تاريخ التعيين': emp.hireDate, 'الحالة': emp.status === 'active' ? 'نشط' : 'غير نشط',
            'الهاتف': emp.phone, 'البريد الإلكتروني': emp.email,
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Employees");
        XLSX.writeFile(wb, "employees_report.xlsx");
    };

    const handleUploadToDevice = async () => {
        if (!selectedUploadDeviceId) {
            setToast({ message: 'الرجاء اختيار جهاز.', type: 'error' });
            return;
        }
        const device = devices.find(d => d.id === selectedUploadDeviceId);
        if (device) {
            setToast({ message: `جاري رفع بيانات الموظفين إلى جهاز ${device.name}...`, type: 'info' });
            const result = await api.device.uploadUsers(device);
            setToast({ message: result.message, type: result.success ? 'success' : 'error' });
        }
        setIsUploadModalOpen(false);
    };

    const zkDevices = useMemo(() => devices.filter(d => d.brand === 'ZKTeco'), [devices]);
    const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);

    // Termination Receipt Component
    const TerminationReceipt = ({ data }: { data: any }) => (
        <div className="printable-termination-receipt">
            <div className="receipt-content">
                <h3 style={{ textAlign: 'center', fontWeight: 'bold' }}>{data.companyName}</h3>
                <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '10pt', margin: '5px 0' }}>مخالصة نهائية وإنهاء خدمة</p>
                
                <div className="line"></div>
                <div className="details">
                    <div><span>الاسم:</span><span>{data.employeeName}</span></div>
                    <div><span>تاريخ الإنهاء:</span><span>{data.terminationDate}</span></div>
                </div>
                
                <div className="line"></div>
                <div className="details">
                    <div><span>الراتب المستحق (للأيام الفعلية):</span><span>{data.baseSalary.toFixed(2)}</span></div>
                    <div><span>إضافي ومكافآت:</span><span>{data.additions.toFixed(2)}</span></div>
                    <div><span>خصميات:</span><span>- {data.deductions.toFixed(2)}</span></div>
                    <div><span>سلف متبقية:</span><span>- {data.advances.toFixed(2)}</span></div>
                </div>
                
                <div className="line"></div>
                <div className="details total">
                    <div><span>الصافي المستحق:</span><span>{data.netAmount.toFixed(2)} {data.currency}</span></div>
                </div>
                
                <p style={{marginTop: '10px'}}>أقر أنا الموقع أدناه باستلام كافة مستحقاتي المالية وأبرئ ذمة الشركة من أي التزام.</p>
                
                <div className="signature" style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between' }}>
                    <p>توقيع الموظف:</p>
                    <p>توقيع المدير:</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className={`p-6 ${receiptData ? 'is-printing' : ''}`}>
            {/* Combined Header and Controls */}
            <div className="bg-white p-4 rounded-xl shadow-md mb-6 flex flex-col lg:flex-row items-center justify-between gap-4 no-print">
                
                {/* Right Side: Title + Search + Filters */}
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto flex-grow">
                    <h2 className="text-2xl font-bold text-neutral whitespace-nowrap ml-2">قائمة الموظفين</h2>
                    
                    <div className="relative w-full sm:w-64">
                        <input 
                            type="text" 
                            placeholder="بحث..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full p-2 pr-8 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                        />
                        <div className="absolute top-2.5 right-2 text-gray-400 pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                    </div>

                    <select 
                        value={filterStatus} 
                        onChange={e => setFilterStatus(e.target.value as any)} 
                        className="w-full sm:w-auto p-2 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    >
                        <option value="all">كل الحالات</option>
                        <option value="active">نشط</option>
                        <option value="inactive">غير نشط</option>
                        <option value="on_leave">في إجازة</option>
                    </select>
                </div>

                {/* Left Side: Actions */}
                <div className="flex items-center gap-2 flex-wrap justify-center lg:justify-end w-full lg:w-auto">
                    <button onClick={handleExport} className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-1 text-sm font-medium">
                        {React.cloneElement(ICONS.export, { className: "h-4 w-4" })} تصدير
                    </button>
                    
                    <button onClick={() => setIsEvaluationModalOpen(true)} className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition flex items-center gap-1 text-sm font-medium">
                         {React.cloneElement(ICONS.evaluation, { className: "h-4 w-4" })} تقييم
                    </button>
                    
                    <button onClick={() => setIsUploadModalOpen(true)} className="bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700 transition flex items-center gap-1 text-sm font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        رفع لجهاز
                    </button>
                    
                    <button onClick={handleOpenTerminationModal} className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition flex items-center gap-1 text-sm font-medium">
                         {React.cloneElement(ICONS.delete, { className: "h-4 w-4" })} إنهاء خدمة
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-x-auto no-print">
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6"><button onClick={() => requestSort('name')} className="font-medium">الاسم{getSortIndicator('name')}</button></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('jobTitleName')} className="font-medium">المسمى الوظيفي{getSortIndicator('jobTitleName')}</button></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('departmentName')} className="font-medium">القسم{getSortIndicator('departmentName')}</button></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('status')} className="font-medium">الحالة{getSortIndicator('status')}</button></th>
                            <th className="py-3 px-6">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredAndSortedEmployees.map(emp => {
                            const isCurrentlyOnLeave = onLeaveTodayIds.has(emp.id);
                            const effectiveStatus = isCurrentlyOnLeave ? 'on_leave' : emp.status;

                            const statusText = {
                                'active': 'نشط',
                                'inactive': 'غير نشط',
                                'on_leave': 'في إجازة'
                            }[effectiveStatus];

                            const statusColorClass = {
                                'active': 'bg-green-100 text-green-800',
                                'inactive': 'bg-red-100 text-red-800',
                                'on_leave': 'bg-yellow-100 text-yellow-800'
                            }[effectiveStatus];
                            
                            const isNewRecruit = emp.source === 'recruitment' && emp.monthlySalary === 0 && emp.weeklySalary === 0 && emp.hourlyRate === 0;
                            const isMaintenance = maintenanceStaff.some(s => s.employeeId === emp.id);

                            let rowClass = 'transition-colors';
                            let rowTitle = '';

                            if (isNewRecruit) {
                                rowClass += ' bg-green-100/50 hover:bg-green-100/70';
                                rowTitle = 'موظف جديد من قسم التوظيف، بحاجة لإكمال البيانات المالية.';
                            } else if (isMaintenance) {
                                rowClass += ' bg-sky-100/50 hover:bg-sky-100/70';
                                rowTitle = 'موظف في قسم الصيانة.';
                            } else {
                                rowClass += ' hover:bg-gray-50';
                            }


                            return (
                                <tr
                                    key={emp.id}
                                    className={rowClass}
                                    title={rowTitle}
                                >
                                    <td className="py-4 px-6">{emp.name}</td>
                                    <td className="py-4 px-6">{getRelatedName(emp.jobTitleId, 'job')}</td>
                                    <td className="py-4 px-6">{getRelatedName(emp.departmentId, 'dept')}</td>
                                    <td className="py-4 px-6">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColorClass}`}>
                                            {statusText}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 space-x-2 space-x-reverse">
                                        <button onClick={() => handleOpenSmsModal(emp)} className="text-sky-600 hover:text-sky-800 p-1" title="إرسال رسالة">{React.cloneElement(ICONS.sms, {className: "h-5 w-5"})}</button>
                                        <button onClick={() => handleOpenAssignModal(emp)} className="text-gray-600 hover:text-gray-800 p-1" title="تخصيص أجهزة">{React.cloneElement(ICONS.assign_device, {className: "h-5 w-5"})}</button>
                                        <button onClick={() => handleEdit(emp)} className="text-primary hover:text-primary-dark p-1">{React.cloneElement(ICONS.edit, {className: "h-5 w-5"})}</button>
                                        <button onClick={() => handleDelete(emp.id)} className="text-red-600 hover:text-red-800 p-1">{React.cloneElement(ICONS.delete, {className: "h-5 w-5"})}</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <Modal title="تعديل بيانات موظف" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="xl" maximizable>
                <form onSubmit={handleSubmit}>
                    <div className="p-1">
                         <div className="flex flex-row-reverse gap-6">
                            {/* Photo Column */}
                            <div className="w-72 flex-shrink-0 space-y-3">
                                {/* Personal Photo */}
                                <div className="text-center">
                                    <h4 className="text-xs font-medium text-gray-700 mb-1">الصورة الشخصية</h4>
                                    <div className="w-36 h-36 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-gray-300 mx-auto">
                                        {activeCameraFor === 'personal' ? (
                                            <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-full object-cover" videoConstraints={{ facingMode: "user" }} />
                                        ) : formData.photo ? (
                                            <img src={`data:image/jpeg;base64,${formData.photo}`} alt="Employee" className="w-full h-full object-cover" />
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        )}
                                    </div>
                                    <input type="file" ref={personalPhotoInputRef} onChange={(e) => handleImageChange(e, 'photo')} className="hidden" accept="image/*" />
                                    <div className="flex justify-center gap-2 mt-2">
                                        {activeCameraFor === 'personal' ? (
                                            <>
                                                <button type="button" onClick={capturePhoto} className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs">التقاط</button>
                                                <button type="button" onClick={() => setActiveCameraFor(null)} className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs">إلغاء</button>
                                            </>
                                        ) : (
                                            <>
                                                <button type="button" onClick={() => setActiveCameraFor('personal')} className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs">الكاميرا</button>
                                                <button type="button" onClick={() => personalPhotoInputRef.current?.click()} className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs">استيراد صورة</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                
                                {/* CV Upload */}
                                <div className="text-center">
                                    <h4 className="text-xs font-medium text-gray-700 mb-1">السيرة الذاتية أو مرفق</h4>
                                    <div className="w-full h-20 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-gray-300">
                                        {formData.cvFileName ? ( <div className="text-center p-1"><p className="font-bold text-blue-600 truncate text-sm">{formData.cvFileName}</p><a href={`data:${formData.cvFileType};base64,${formData.cvFile}`} download={formData.cvFileName} className="text-xs text-blue-500 hover:underline">تحميل</a></div>) : (<span className="text-gray-500 text-xs">لم يتم رفع ملف</span>)}
                                    </div>
                                    <input type="file" ref={cvFileInputRef} onChange={(e) => handleFileUpload(e, 'cv')} className="hidden" accept="image/*,application/pdf,.doc,.docx" />
                                    <button type="button" onClick={() => cvFileInputRef.current?.click()} className="mt-2 w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">{formData.cvFile ? 'تغيير الملف' : 'استيراد ملف CV'}</button>
                                </div>

                                {/* ID Front */}
                                <div className="text-center">
                                    <h4 className="text-xs font-medium text-gray-700 mb-1">صورة الهوية (الوجه الأمامي)</h4>
                                    <div className="w-full h-32 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-gray-300">
                                        {activeCameraFor === 'idFront' ? <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-full object-cover"/> : formData.idPhotoFront ? <img src={`data:image/jpeg;base64,${formData.idPhotoFront}`} alt="ID Front" className="w-full h-full object-cover" /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>}
                                    </div>
                                    <input type="file" ref={idPhotoFrontInputRef} onChange={(e) => handleImageChange(e, 'idPhotoFront')} className="hidden" accept="image/*" />
                                     <div className="flex justify-center gap-2 mt-2">
                                        {activeCameraFor === 'idFront' ? (
                                            <>
                                                <button type="button" onClick={capturePhoto} className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs">التقاط</button>
                                                <button type="button" onClick={() => setActiveCameraFor(null)} className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs">إلغاء</button>
                                            </>
                                        ) : (
                                            <>
                                                <button type="button" onClick={() => setActiveCameraFor('idFront')} className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs">الكاميرا</button>
                                                <button type="button" onClick={() => idPhotoFrontInputRef.current?.click()} className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs">استيراد صورة</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                
                                {/* ID Back */}
                                <div className="text-center">
                                    <h4 className="text-xs font-medium text-gray-700 mb-1">صورة الهوية (الوجه الخلفي)</h4>
                                    <div className="w-full h-32 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-gray-300">
                                        {activeCameraFor === 'idBack' ? <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-full object-cover"/> : formData.idPhotoBack ? <img src={`data:image/jpeg;base64,${formData.idPhotoBack}`} alt="ID Back" className="w-full h-full object-cover" /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>}
                                    </div>
                                    <input type="file" ref={idPhotoBackInputRef} onChange={(e) => handleImageChange(e, 'idPhotoBack')} className="hidden" accept="image/*" />
                                     <div className="flex justify-center gap-2 mt-2">
                                        {activeCameraFor === 'idBack' ? (
                                            <>
                                                <button type="button" onClick={capturePhoto} className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs">التقاط</button>
                                                <button type="button" onClick={() => setActiveCameraFor(null)} className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs">إلغاء</button>
                                            </>
                                        ) : (
                                            <>
                                                <button type="button" onClick={() => setActiveCameraFor('idBack')} className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs">الكاميرا</button>
                                                <button type="button" onClick={() => idPhotoBackInputRef.current?.click()} className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs">استيراد صورة</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Fields Columns */}
                            <div className="flex-1 space-y-4">
                               <fieldset className="border rounded-md p-3">
                                    <legend className="px-2 text-sm font-semibold">المعلومات الأساسية والوظيفية</legend>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 p-1">
                                        <div className="md:col-span-3">
                                            <label className="block text-xs font-medium text-gray-700 mb-1">طريقة الإدخال</label>
                                            <select value={inputMethod} onChange={(e) => { const newMethod = e.target.value as 'manual' | 'scanner'; setInputMethod(newMethod); if (newMethod === 'scanner') { if (!scannerSettingsRef.current.port) { setToast({ message: 'يرجى تكوين منفذ الماسح الضوئي في الإعدادات أولاً.', type: 'error' }); setInputMethod('manual'); return; } setIsScanningId(true); } else { setIsScanningId(false); }}} className="w-full p-2 border rounded-md bg-white text-sm" disabled={isScanningId}><option value="manual">إدخال يدوي</option><option value="scanner">استخدام ماسح الهوية</option></select>
                                            {isScanningId && <p className="text-xs text-blue-600 mt-1 animate-pulse">في انتظار بيانات الماسح الضوئي...</p>}
                                        </div>
                                        <div className="md:col-span-2"><label className="block text-xs font-medium text-gray-700 mb-1">اسم الموظف</label><input name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded-md disabled:bg-gray-100 text-sm" required disabled={inputMethod === 'scanner' || isScanningId} /></div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">رقم الموظف</label>
                                            <input name="employeeCode" value={formData.employeeCode} onChange={handleChange} className={`w-full p-2 border rounded-md text-sm ${errors.employeeCode ? 'border-red-500' : ''}`} required />
                                            {errors.employeeCode && <p className="text-red-500 text-xs mt-1">{errors.employeeCode}</p>}
                                        </div>
                                        <div className="md:col-span-2"><label className="block text-xs font-medium text-gray-700 mb-1">الرقم الوطني</label><input name="nationalId" value={formData.nationalId || ''} onChange={handleChange} className="w-full p-2 border rounded-md disabled:bg-gray-100 text-sm" disabled={inputMethod === 'scanner' || isScanningId} /></div>
                                        <div><label className="block text-xs font-medium text-gray-700 mb-1">تاريخ التوظيف</label><input name="hireDate" type="date" value={formData.hireDate} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" required /></div>
                                        <div><label className="block text-xs font-medium text-gray-700 mb-1">الفرع</label><select name="branchId" value={formData.branchId} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-sm" required><option value={0} disabled>اختر الفرع</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                                        <div><label className="block text-xs font-medium text-gray-700 mb-1">القسم</label><select name="departmentId" value={formData.departmentId} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-sm" required><option value={0} disabled>اختر القسم</option>{departments.filter(d => d.branchId === formData.branchId).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                                        <div><label className="block text-xs font-medium text-gray-700 mb-1">المسمى الوظيفي</label><select name="jobTitleId" value={formData.jobTitleId} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-sm" required><option value={0} disabled>اختر المسمى</option>{jobTitles.filter(j => j.departmentId === formData.departmentId).map(j => <option key={j.id} value={j.id}>{j.name}</option>)}</select></div>
                                        <div><label className="block text-xs font-medium text-gray-700 mb-1">الهاتف</label><input name="phone" value={formData.phone} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" /></div>
                                        <div className="md:col-span-2"><label className="block text-xs font-medium text-gray-700 mb-1">البريد الإلكتروني</label><input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" /></div>
                                        <div className="md:col-span-3"><label className="block text-xs font-medium text-gray-700 mb-1">عنوان الموظف</label><input name="address" value={formData.address || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" /></div>
                                    </div>
                                </fieldset>
                                <fieldset className="border rounded-md p-3">
                                    <legend className="px-2 text-sm font-semibold">بيانات الدوام والراتب</legend>
                                     <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 p-1">
                                        <div><label className="block text-xs font-medium text-gray-700 mb-1">نوع تسجيل الدخول</label><select name="checkInType" value={formData.checkInType || ''} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-sm" required>{Object.entries(checkInTypeTranslations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">معرّف جهاز البصمة</label>
                                            <input name="biometricId" value={formData.biometricId} onChange={handleChange} className={`w-full p-2 border rounded-md disabled:bg-gray-100 text-sm ${errors.biometricId ? 'border-red-500' : ''}`} disabled={inputMethod === 'scanner' || isScanningId} />
                                            {errors.biometricId && <p className="text-red-500 text-xs mt-1">{errors.biometricId}</p>}
                                        </div>
                                        <div><label className="block text-xs font-medium text-gray-700 mb-1">نوع الدوام</label><select name="paymentType" value={formData.paymentType} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-sm" required><option value="hourly">نظام ساعات</option><option value="monthly">راتب شهري</option><option value="weekly">راتب أسبوعي</option></select></div>
                                        
                                        <div className="md:col-span-3">
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                قيمة خصم دقيقة التأخير
                                                <span className="text-gray-400"> (اتركه 0 للاحتساب التلقائي من الراتب)</span>
                                            </label>
                                            <input name="latenessDeductionRate" type="number" step="any" min="0" value={formData.latenessDeductionRate || 0} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" />
                                        </div>

                                        {formData.paymentType === 'hourly' ? (<><div><label className="block text-xs font-medium text-gray-700 mb-1">ساعات العمل اليومية</label><input name="agreedDailyHours" type="number" step="any" min="0" value={formData.agreedDailyHours || 0} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" required /></div><div><label className="block text-xs font-medium text-gray-700 mb-1">سعر ساعة العمل</label><input name="hourlyRate" type="number" step="any" min="0" value={formData.hourlyRate || 0} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" required /></div><div><label className="block text-xs font-medium text-gray-700 mb-1">مضاعف العمل الإضافي (مثال: 1.5 أو 2)</label><input name="overtimeRate" type="number" step="any" min="0" value={formData.overtimeRate || 0} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" required /></div></>) : formData.paymentType === 'monthly' ? (<><div className="md:col-span-2"><label className="block text-xs font-medium text-gray-700 mb-1">الراتب الشهري</label><input name="monthlySalary" type="number" step="any" min="0" value={formData.monthlySalary || 0} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" required /></div><div><label className="block text-xs font-medium text-gray-700 mb-1">عملة الراتب</label><select name="salaryCurrency" value={formData.salaryCurrency || ''} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-sm"><option value="SYP">ليرة سوري</option><option value="USD">دولار أمريكي</option><option value="TRY">ليرة تركي</option></select></div><div><label className="block text-xs font-medium text-gray-700 mb-1">ساعات العمل اليومية</label><input name="agreedDailyHours" type="number" step="any" min="0" value={formData.agreedDailyHours || 0} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" required /></div><div><label className="block text-xs font-medium text-gray-700 mb-1">سعر ساعة العمل (للإضافي/الحسم)</label><input name="hourlyRate" type="number" step="any" min="0" value={formData.hourlyRate || 0} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" /></div><div><label className="block text-xs font-medium text-gray-700 mb-1">مضاعف العمل الإضافي (مثال: 1.5 أو 2)</label><input name="overtimeRate" type="number" step="any" min="0" value={formData.overtimeRate || 0} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" /></div></>) : formData.paymentType === 'weekly' ? (<><div><label className="block text-xs font-medium text-gray-700 mb-1">الراتب الأسبوعي</label><input name="weeklySalary" type="number" step="any" min="0" value={formData.weeklySalary || 0} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" required /></div><div><label className="block text-xs font-medium text-gray-700 mb-1">عملة الراتب</label><select name="salaryCurrency" value={formData.salaryCurrency || ''} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-sm"><option value="SYP">ليرة سوري</option><option value="USD">دولار أمريكي</option><option value="TRY">ليرة تركي</option></select></div><div><label className="block text-xs font-medium text-gray-700 mb-1">ساعات العمل اليومية</label><input name="agreedDailyHours" type="number" step="any" min="0" value={formData.agreedDailyHours || 0} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" required /></div><div><label className="block text-xs font-medium text-gray-700 mb-1">سعر ساعة العمل (للإضافي/الحسم)</label><input name="hourlyRate" type="number" step="any" min="0" value={formData.hourlyRate || 0} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" /></div><div><label className="block text-xs font-medium text-gray-700 mb-1">مضاعف العمل الإضافي (مثال: 1.5 أو 2)</label><input name="overtimeRate" type="number" step="any" min="0" value={formData.overtimeRate || 0} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" /></div></>) : null}
                                         <div className="md:col-span-3 pt-2">
                                            <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    name="calculateSalaryBy30Days"
                                                    checked={!!formData.calculateSalaryBy30Days}
                                                    onChange={(e) => setFormData(prev => ({...prev, calculateSalaryBy30Days: e.target.checked}))}
                                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <span className="text-sm font-medium text-gray-700">احتساب الراتب شاملاً أيام العطلة الأسبوعية (تقسيم على 30 شهرياً / 7 أسبوعياً)</span>
                                            </label>
                                        </div>
                                    </div>
                                </fieldset>
                                <fieldset className="border rounded-md p-3">
                                    <legend className="px-2 text-sm font-semibold">بيانات العقد والخبرات</legend>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 p-1">
                                        <div><label className="block text-xs font-medium text-gray-700 mb-1">نوع العمل</label><select name="employmentType" value={formData.employmentType} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-sm"><option value="freelance">حر</option><option value="contract">عقد</option></select></div>
                                        <div className="md:col-span-2"><label className="block text-xs font-medium text-gray-700 mb-1">المسمى الوظيفي السابق</label><input name="previousJobTitle" value={formData.previousJobTitle || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" /></div>
                                        {formData.employmentType === 'contract' && (<><div><label className="block text-xs font-medium text-gray-700 mb-1">تاريخ بدء العقد</label><input name="contractStartDate" type="date" value={formData.contractStartDate || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" /></div><div><label className="block text-xs font-medium text-gray-700 mb-1">تاريخ انتهاء العقد</label><input name="contractEndDate" type="date" value={formData.contractEndDate || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" /></div><div className="flex flex-col items-start justify-center"><label className="block text-xs font-medium text-gray-700 mb-1">ملف العقد</label><input type="file" ref={contractFileInputRef} onChange={(e) => handleFileUpload(e, 'contract')} className="hidden" accept="image/*,application/pdf,.doc,.docx" /><button type="button" onClick={() => contractFileInputRef.current?.click()} className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm">{formData.contractFileName ? 'تغيير الملف' : 'رفع ملف العقد'}</button>{formData.contractFileName && (<a href={`data:${formData.contractFileType};base64,${formData.contractFile}`} download={formData.contractFileName} className="text-xs text-blue-500 hover:underline mt-1">{formData.contractFileName}</a>)}</div></>)}
                                        <div className="md:col-span-3"><label className="block text-xs font-medium text-gray-700 mb-1">ملاحظات وخبرات</label><textarea name="employeeNotes" value={formData.employeeNotes || ''} onChange={handleChange} rows={2} className="w-full p-2 border rounded-md text-sm"></textarea></div>
                                    </div>
                                </fieldset>
                                
                                <fieldset className="border rounded-md p-3">
                                    <legend className="px-2 text-sm font-semibold">جدول الدوام وأيام العمل</legend>
                                    <div className="space-y-3 p-1">
                                        <div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div><label className="block text-xs font-medium text-gray-600 mb-1">وقت بدء الدخول</label><input name="checkInStartTime" type="time" value={formData.checkInStartTime || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" /></div>
                                                <div><label className="block text-xs font-medium text-gray-600 mb-1">وقت انتهاء الدخول (تأخير)</label><input name="checkInEndTime" type="time" value={formData.checkInEndTime || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" /></div>
                                                <div><label className="block text-xs font-medium text-gray-600 mb-1">وقت بدء الخروج</label><input name="checkOutStartTime" type="time" value={formData.checkOutStartTime || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" /></div>
                                                <div><label className="block text-xs font-medium text-gray-600 mb-1">وقت انتهاء الخروج (إضافي)</label><input name="checkOutEndTime" type="time" value={formData.checkOutEndTime || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" /></div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-2">أيام الدوام الرسمية للموظف</label>
                                            <div className="grid grid-cols-4 lg:grid-cols-7 gap-2">
                                                {weekDays.map(day => (
                                                    <label key={day.id} className="flex items-center space-x-2 space-x-reverse p-2 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-400">
                                                        <input type="checkbox" checked={(formData.workdays || []).includes(day.id)} onChange={() => handleWorkdayChange(day.id)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"/>
                                                        <span className="text-xs font-medium text-gray-700">{day.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2">إذا لم يتم تحديد أيام، سيتم تطبيق أيام الدوام العامة.</p>
                                        </div>
                                    </div>
                                </fieldset>
                            </div>
                        </div>
                    </div>
                    {/* Form Actions */}
                    <div className="flex justify-end gap-3 mt-4 border-t pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">حفظ</button>
                    </div>
                </form>
            </Modal>
            
            <Modal title="رفع الموظفين إلى جهاز" isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)}>
                <div className="space-y-4">
                    <p className="text-gray-600">اختر جهاز ZKTeco لرفع قائمة الموظفين النشطين إليه. سيؤدي هذا إلى مسح المستخدمين الحاليين على الجهاز واستبدالهم بالقائمة الجديدة.</p>
                    <label htmlFor="device-select" className="block text-sm font-medium text-gray-700">اختر الجهاز:</label>
                    <select id="device-select" value={selectedUploadDeviceId} onChange={e => setSelectedUploadDeviceId(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-primary focus:border-primary">
                        <option value="" disabled>-- اختر جهاز --</option>
                        {zkDevices.length > 0 ? zkDevices.map(device => (
                            <option key={device.id} value={device.id}>{device.name} ({device.ip})</option>
                        )) : (
                            <option disabled>لا توجد أجهزة ZKTeco معرفة</option>
                        )}
                    </select>
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => setIsUploadModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button onClick={handleUploadToDevice} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition" disabled={zkDevices.length === 0}>
                           بدء الرفع
                        </button>
                    </div>
                </div>
            </Modal>
            
            <Modal 
                title={`تخصيص أجهزة لـ ${employeeToAssign?.name}`}
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
            >
                <div className="space-y-4">
                    <p className="text-gray-600">اختر أجهزة البصمة التي يمكن لهذا الموظف استخدامها. سيتم مزامنة بيانات هذا الموظف مع الأجهزة المحددة فقط.</p>
                    <div className="max-h-60 overflow-y-auto border rounded-lg p-3 space-y-2">
                        {devices.length > 0 ? devices.map(device => (
                            <label key={device.id} className="flex items-center p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedDevices.has(device.id)}
                                    onChange={() => handleDeviceSelection(device.id)}
                                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary ml-3"
                                />
                                <span>{device.name} <span className="text-sm text-gray-500">({device.ip})</span></span>
                            </label>
                        )) : (
                            <p className="text-gray-500 text-center">لا توجد أجهزة معرفة.</p>
                        )}
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button onClick={handleAssignDevicesSave} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition">
                           حفظ التخصيص
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal title="إنهاء خدمة موظف / مخالصة نهائية" isOpen={isTerminationModalOpen} onClose={() => setIsTerminationModalOpen(false)} size="large">
                {!showSettlementReview ? (
                    <form onSubmit={handleCalculateSettlement} className="space-y-4 p-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">اختر الموظف</label>
                            <select
                                name="employeeId"
                                value={terminationData.employeeId}
                                onChange={(e) => setTerminationData(prev => ({ ...prev, employeeId: e.target.value }))}
                                className="w-full p-2 border rounded-md bg-white"
                                required
                            >
                                <option value="" disabled>-- قائمة الموظفين النشطين --</option>
                                {activeEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ إنهاء الخدمة (آخر يوم عمل)</label>
                            <input
                                type="date"
                                name="terminationDate"
                                value={terminationData.terminationDate}
                                onChange={(e) => setTerminationData(prev => ({ ...prev, terminationDate: e.target.value }))}
                                className="w-full p-2 border rounded-md"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">السبب</label>
                            <textarea
                                name="reason"
                                value={terminationData.reason}
                                onChange={(e) => setTerminationData(prev => ({ ...prev, reason: e.target.value }))}
                                rows={3}
                                className="w-full p-2 border rounded-md"
                                required
                            ></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات إضافية</label>
                            <textarea
                                name="notes"
                                value={terminationData.notes}
                                onChange={(e) => setTerminationData(prev => ({ ...prev, notes: e.target.value }))}
                                rows={2}
                                className="w-full p-2 border rounded-md"
                            ></textarea>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button type="button" onClick={() => setIsTerminationModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">التالي: حساب المستحقات والمراجعة</button>
                        </div>
                    </form>
                ) : (
                    <div className="p-2 space-y-6">
                        {settlementData ? (
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h4 className="font-bold text-lg text-center mb-4 border-b pb-2">تفاصيل المخالصة المالية</h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                    <div className="space-y-2">
                                        <h5 className="font-semibold text-green-700 border-b border-green-200 pb-1">المستحقات</h5>
                                        <div className="flex justify-between">
                                            <span>الراتب المستحق (عن الفترة):</span>
                                            <span className="font-mono">{settlementData.baseSalary.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>العمل الإضافي:</span>
                                            <span className="font-mono">{settlementData.overtimePay.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>المكافآت:</span>
                                            <span className="font-mono">{settlementData.bonusesTotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between font-bold border-t pt-1">
                                            <span>الإجمالي:</span>
                                            <span className="font-mono text-green-800">{(settlementData.baseSalary + settlementData.overtimePay + settlementData.bonusesTotal).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h5 className="font-semibold text-red-700 border-b border-red-200 pb-1">الخصميات والالتزامات</h5>
                                        <div className="flex justify-between">
                                            <span>خصم التأخير/الغياب:</span>
                                            <span className="font-mono">{(settlementData.latenessDeductions + settlementData.unpaidLeaveDeductions).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>خصميات يدوية:</span>
                                            <span className="font-mono">{settlementData.manualDeductionsTotal.toFixed(2)}</span>
                                        </div>
                                        {/* Important: Show outstanding advances here, even if calculated as 0 in normal payroll, 
                                            we need to check database directly or use what API returned if enhanced */}
                                        <div className="flex justify-between text-orange-600">
                                            <span>سلف متبقية:</span>
                                            {/* Note: The API currently returns 'advancesTotal' as 0 usually, but 'outstandingAdvances' array is available if passed through */}
                                            <span className="font-mono">{(settlementData.outstandingAdvances?.reduce((sum, a) => sum + a.amount, 0) || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between font-bold border-t pt-1">
                                            <span>الإجمالي:</span>
                                            <span className="font-mono text-red-800">
                                                {(
                                                    settlementData.totalDeductions + 
                                                    (settlementData.outstandingAdvances?.reduce((sum, a) => sum + a.amount, 0) || 0)
                                                ).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 text-center">
                                    <p className="text-gray-600 text-sm mb-1">صافي المبلغ المستحق للدفع (براءة الذمة)</p>
                                    <p className="text-3xl font-bold text-neutral">
                                        {(
                                            (settlementData.baseSalary + settlementData.overtimePay + settlementData.bonusesTotal) - 
                                            (settlementData.totalDeductions + (settlementData.outstandingAdvances?.reduce((sum, a) => sum + a.amount, 0) || 0))
                                        ).toFixed(2)} 
                                        <span className="text-lg font-normal text-gray-500 ml-1">
                                            {employees.find(e => e.id === Number(terminationData.employeeId))?.salaryCurrency}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10"><span className="animate-spin h-5 w-5 border-t-2 border-b-2 border-primary rounded-full inline-block"></span></div>
                        )}

                        <div className="flex justify-between items-center pt-4 border-t gap-3">
                            <button type="button" onClick={() => setShowSettlementReview(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">رجوع</button>
                            <div className="flex gap-2">
                                <button type="button" onClick={handlePrintSettlement} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                                    {React.cloneElement(ICONS.print, { className: "h-5 w-5" })}
                                    طباعة المخالصة
                                </button>
                                <button onClick={handleConfirmTermination} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold">تأكيد الإنهاء والحفظ</button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
            
            <SendSmsModal 
                isOpen={isSmsModalOpen} 
                onClose={() => setIsSmsModalOpen(false)}
                api={api}
                setToast={setToast}
                initialTarget={smsTarget}
            />

            <Modal title="تقييم أداء الموظف" isOpen={isEvaluationModalOpen} onClose={() => setIsEvaluationModalOpen(false)} size="xl" maximizable>
                <EmployeeEvaluation
                    employees={employees}
                    attendance={attendance}
                    salaryAdvances={salaryAdvances}
                    leaveRequests={leaveRequests}
                    bonuses={bonuses}
                    deductions={deductions}
                    departments={departments}
                    jobTitles={jobTitles}
                    workdays={workdays}
                    api={api}
                    maintenanceRecords={maintenanceRecords}
                    maintenanceStaff={maintenanceStaff}
                />
            </Modal>
            
            {receiptData && <TerminationReceipt data={receiptData} />}
        </div>
    );
};

// Reusable Send SMS Modal Component
interface SendSmsModalProps {
    isOpen: boolean;
    onClose: () => void;
    api: IElectronAPI;
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
    initialTarget?: { name: string, phone: string } | null;
}

const SendSmsModal: React.FC<SendSmsModalProps> = ({ isOpen, onClose, api, setToast, initialTarget }) => {
    const [text, setText] = useState('');
    const [priority, setPriority] = useState<SMSPriority>('MEDIUM');

    useEffect(() => {
        if (isOpen) {
            setText('');
            setPriority('MEDIUM');
        }
    }, [isOpen]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!initialTarget || !text.trim()) {
            setToast({ message: 'الهدف غير محدد أو الرسالة فارغة.', type: 'error' });
            return;
        }

        const result = await api.sms.send({
            recipientName: initialTarget.name,
            recipientPhone: initialTarget.phone,
            text: text.trim(),
            priority,
            origin: 'MANUAL'
        });

        setToast({ message: result.message, type: result.success ? 'success' : 'error' });
        if (result.success) {
            onClose();
        }
    };
    
    return (
        <Modal title={`إرسال رسالة إلى ${initialTarget?.name || ''}`} isOpen={isOpen} onClose={onClose}>
            <form onSubmit={handleSubmit} className="p-2 space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">نص الرسالة</label>
                    <textarea value={text} onChange={e => setText(e.target.value)} rows={4} className="w-full p-2 border rounded-md" required></textarea>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الأولوية</label>
                    <select value={priority} onChange={e => setPriority(e.target.value as SMSPriority)} className="w-full p-2 border rounded-md bg-white">
                        <option value="HIGH">عالية</option>
                        <option value="MEDIUM">متوسطة</option>
                        <option value="LOW">منخفضة</option>
                    </select>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                    <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">إرسال</button>
                </div>
            </form>
        </Modal>
    );
};


export default Employees;