import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Webcam from 'react-webcam';
import { JobApplication, IElectronAPI, ScannedIDData, Experience, Attachment, JobApplicationStatus, Availability, MaritalStatus, Branch, Department, JobTitle, SMSPriority, Employee, SalaryCurrency } from '../types';
import Modal from './ui/Modal';
import { ICONS } from '../constants';

const statusTranslations: Record<JobApplicationStatus, string> = {
    'Pending': 'قيد الانتظار',
    'Interview': 'مقابلة',
    'Accepted': 'مقبول',
    'Rejected': 'مرفوض'
};

const availabilityTranslations: Record<Availability, string> = {
    'full-time': 'دوام كامل',
    'part-time': 'دوام جزئي',
    'freelance': 'عمل حر'
};

const maritalStatusTranslations: Record<MaritalStatus, string> = {
    'single': 'أعزب',
    'married': 'متزوج',
    'divorced': 'مطلق',
    'widowed': 'أرمل'
};

const initialExperience: Experience = { jobTitle: '', company: '', responsibilities: '', duration: '' };
const initialFormData: Omit<JobApplication, 'id'> = {
    fullName: '', phone: '', address: '',
    dob: '', maritalStatus: 'single',
    experiences: [initialExperience],
    qualifications: '', trainingCourses: '',
    availability: 'full-time',
    attachments: [],
    notes: '',
    status: 'Pending',
    interviewDateTime: null,
    createdEmployeeId: null,
    photo: '',
    idPhotoFront: '',
    idPhotoBack: '',
};

interface RecruitmentProps {
    jobApplications: JobApplication[];
    branches: Branch[];
    departments: Department[];
    jobTitles: JobTitle[];
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
    api: IElectronAPI;
}

const allColumns = [
    { key: 'fullName', name: 'الاسم الكامل', sortable: true },
    { key: 'phone', name: 'رقم الهاتف', sortable: false },
    { key: 'id', name: 'تاريخ الإنشاء', sortable: true },
    { key: 'dob', name: 'تاريخ الميلاد', sortable: true },
    { key: 'address', name: 'السكن', sortable: false },
    { key: 'experiences', name: 'الخبرات العملية', sortable: false },
    { key: 'availability', name: 'التفرغ', sortable: false },
    { key: 'status', name: 'الحالة', sortable: true },
    { key: 'interviewDateTime', name: 'موعد المقابلة', sortable: true },
    { key: 'notes', name: 'ملاحظات إضافية', sortable: false },
];

const PrintableApplication: React.FC<{ data: JobApplication }> = ({ data }) => {
    return (
        <div className="printable-content-a4">
            <h1 className="text-2xl font-bold border-b pb-2 mb-4">طلب توظيف: {data.fullName}</h1>
            <div className="space-y-3 text-base">
                <div className="grid grid-cols-2 gap-4">
                    <p><strong>الهاتف:</strong> {data.phone}</p>
                    <p><strong>تاريخ الميلاد:</strong> {data.dob || 'غير محدد'}</p>
                    <p><strong>الحالة الاجتماعية:</strong> {data.maritalStatus ? maritalStatusTranslations[data.maritalStatus] : 'غير محدد'}</p>
                    <p><strong>التفرغ:</strong> {availabilityTranslations[data.availability]}</p>
                </div>
                <p><strong>العنوان:</strong> {data.address || 'غير محدد'}</p>

                <h2 className="text-xl font-semibold border-t pt-3 mt-4">المؤهلات والدورات التدريبية</h2>
                <p className="whitespace-pre-wrap">{data.qualifications || 'لا يوجد'}</p>
                <p className="whitespace-pre-wrap">{data.trainingCourses || 'لا يوجد'}</p>

                <h2 className="text-xl font-semibold border-t pt-3 mt-4">الخبرات العملية</h2>
                {data.experiences.length > 0 ? data.experiences.map((exp, i) => (
                    <div key={i} className="mb-3 pb-2 border-b last:border-b-0">
                        <p><strong>{exp.jobTitle}</strong> في {exp.company} ({exp.duration})</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{exp.responsibilities}</p>
                    </div>
                )) : <p>لا توجد خبرات مسجلة.</p>}
                
                <h2 className="text-xl font-semibold border-t pt-3 mt-4">ملاحظات إضافية</h2>
                <p className="whitespace-pre-wrap">{data.notes || 'لا يوجد'}</p>
            </div>
        </div>
    );
};


const Recruitment: React.FC<RecruitmentProps> = ({ jobApplications, refreshData, setToast, api, branches, departments, jobTitles }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
    const [formData, setFormData] = useState<Omit<JobApplication, 'id'>>(initialFormData);
    const [isScanning, setIsScanning] = useState(false);
    const [printData, setPrintData] = useState<JobApplication | null>(null);
    const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
        new Set(['fullName', 'phone', 'status', 'interviewDateTime', 'address', 'id'])
    );
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | JobApplicationStatus>('all');
    const [filterAvailability, setFilterAvailability] = useState<'all' | Availability>('all');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' }>({ key: 'id', direction: 'descending' });
    const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
    const [smsTarget, setSmsTarget] = useState<{name: string, phone: string} | null>(null);
    
    // State for the new "Accept Application" modal
    const [isAcceptanceModalOpen, setIsAcceptanceModalOpen] = useState(false);
    const [applicationToAccept, setApplicationToAccept] = useState<(JobApplication & {id: number}) | null>(null);
    const [acceptanceFormData, setAcceptanceFormData] = useState({
        branchId: 0,
        departmentId: 0,
        jobTitleId: 0,
        paymentType: 'monthly' as Employee['paymentType'],
        salaryCurrency: 'SYP' as SalaryCurrency,
        agreedDailyHours: 8,
        monthlySalary: 0,
        weeklySalary: 0,
        hourlyRate: 0,
        overtimeRate: 0,
        checkInStartTime: '08:00',
        checkInEndTime: '09:00',
        checkOutStartTime: '17:00',
        checkOutEndTime: '18:00',
    });


    const scannerSettingsRef = useRef({ port: '', baudRate: 19200 });
    const attachmentsInputRef = useRef<HTMLInputElement>(null);
    const webcamRef = useRef<Webcam>(null);
    const personalPhotoInputRef = useRef<HTMLInputElement>(null);
    const idPhotoFrontInputRef = useRef<HTMLInputElement>(null);
    const idPhotoBackInputRef = useRef<HTMLInputElement>(null);
    const [activeCameraFor, setActiveCameraFor] = useState<null | 'personal' | 'idFront' | 'idBack'>(null);
    
    // Turn off camera when modal closes
    useEffect(() => {
        if (!isModalOpen) {
            setActiveCameraFor(null);
        }
    }, [isModalOpen]);

    // Effect to load column settings from database
    useEffect(() => {
        const loadSettings = async () => {
            const setting = await api.db.getSettings('recruitmentVisibleColumns');
            if (setting && setting.value) {
                try {
                    const savedColumns = JSON.parse(setting.value);
                    if (Array.isArray(savedColumns)) {
                        setVisibleColumns(new Set(savedColumns));
                    }
                } catch (e) {
                    console.error("Failed to parse recruitment column settings", e);
                }
            }
        };
        loadSettings();
    }, [api.db]);

    // Fetch scanner settings on component mount
    useEffect(() => {
        const fetchScannerSettings = async () => {
            const portSetting = await api.db.getSettings('scannerComPort');
            const baudRateSetting = await api.db.getSettings('scannerBaudRate');
            if (portSetting) scannerSettingsRef.current.port = JSON.parse(portSetting.value);
            if (baudRateSetting) scannerSettingsRef.current.baudRate = JSON.parse(baudRateSetting.value);
        };
        fetchScannerSettings();
    }, [api.db]);

    // Scanner listener effect
    useEffect(() => {
        if (!isScanning || !isModalOpen) return;

        const handleScanData = (data: ScannedIDData) => {
            setToast({ message: 'تم استلام بيانات الهوية.', type: 'success' });
            setFormData(prev => ({ ...prev, fullName: data.full_name }));
            setIsScanning(false);
        };
        const handleScanError = ({ message }: { message: string }) => {
            setToast({ message, type: 'error' });
            setIsScanning(false);
        };

        api.scanner.onScanData(handleScanData);
        api.scanner.onScanError(handleScanError);
        api.scanner.startListener(scannerSettingsRef.current);
        
        return () => {
            api.scanner.stopListener();
            api.scanner.removeListeners();
        };
    }, [isScanning, isModalOpen, api.scanner, setToast]);
    
    // Print effect
    useEffect(() => {
        if (printData) {
            const timer = setTimeout(() => {
                api.app.print({})
                   .catch(err => console.error("Print failed:", err))
                   .finally(() => setPrintData(null));
            }, 100); // Delay to allow render
            return () => clearTimeout(timer);
        }
    }, [printData, api.app]);
    
    const requestSort = (key: string) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig?.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    const handleColumnToggle = (columnKey: string) => {
        const newSet = new Set(visibleColumns);
        if (newSet.has(columnKey)) {
            newSet.delete(columnKey);
        } else {
            newSet.add(columnKey);
        }
        setVisibleColumns(newSet);
        api.db.updateSettings('recruitmentVisibleColumns', Array.from(newSet));
    };

    const handleAdd = () => {
        setSelectedApplication(null);
        setFormData(initialFormData);
        setIsModalOpen(true);
    };

    const handleEdit = (app: JobApplication) => {
        setSelectedApplication(app);
        const { id, ...appData } = app;
        setFormData({
            ...initialFormData,
            ...appData,
        });
        setIsModalOpen(true);
    };

    const handleOpenSmsModal = (app: JobApplication) => {
        if (!app.phone) {
            setToast({ message: 'لا يوجد رقم هاتف مسجل لهذا المتقدم.', type: 'error' });
            return;
        }
        setSmsTarget({ name: app.fullName, phone: app.phone });
        setIsSmsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف طلب التوظيف هذا؟')) {
            await api.db.delete('jobApplications', id);
            await refreshData();
            setToast({ message: 'تم حذف الطلب بنجاح.', type: 'success' });
        }
    };

    const handleScan = () => {
        if (!scannerSettingsRef.current.port) {
            setToast({ message: 'الرجاء تحديد منفذ الماسح الضوئي في الإعدادات أولاً.', type: 'error' });
            return;
        }
        setIsScanning(true);
        setToast({ message: 'جاري انتظار المسح...', type: 'info' });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleExperienceChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const newExperiences = [...formData.experiences];
        newExperiences[index] = { ...newExperiences[index], [name]: value };
        setFormData(prev => ({ ...prev, experiences: newExperiences }));
    };

    const addExperience = () => {
        setFormData(prev => ({ ...prev, experiences: [...prev.experiences, initialExperience] }));
    };

    const removeExperience = (index: number) => {
        setFormData(prev => ({ ...prev, experiences: prev.experiences.filter((_, i) => i !== index) }));
    };

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
        setActiveCameraFor(null);
    }, [webcamRef, activeCameraFor]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'photo' | 'idPhotoFront' | 'idPhotoBack') => {
        const file = e.target.files?.[0];
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
            reader.readAsDataURL(file);
        }
    };

    const handleAttachments = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newAttachments: Attachment[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file) continue;
            const reader = new FileReader();
            const fileData = await new Promise<string>((resolve, reject) => {
                reader.onload = (event) => {
                    if (event.target && typeof event.target.result === 'string') {
                        resolve(event.target.result.split(',')[1]);
                    } else {
                        reject(new Error('Failed to read file.'));
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            newAttachments.push({ fileName: file.name, fileType: file.type, fileData });
        }
        setFormData(prev => ({ ...prev, attachments: [...prev.attachments, ...newAttachments] }));
    };
    
    const removeAttachment = (index: number) => {
        setFormData(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== index) }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
    
        if (!selectedApplication) { // Logic for new application
            if (formData.status === 'Accepted') {
                if (branches.length === 0 || departments.length === 0 || jobTitles.length === 0) {
                    setToast({ message: 'لا يمكن قبول الطلب. يرجى إضافة فرع وقسم ومسمى وظيفي واحد على الأقل في الإعدادات أولاً.', type: 'error' });
                    return;
                }
    
                try {
                    const newApplication = await api.db.insert('jobApplications', formData);
                    if (!newApplication || !newApplication.id) {
                        throw new Error("Failed to create the application record in the database.");
                    }
                    
                    setApplicationToAccept(newApplication);
    
                    const firstBranchId = branches[0].id;
                    const firstDepartment = departments.find(d => d.branchId === firstBranchId);
                    const firstJobTitle = firstDepartment ? jobTitles.find(j => j.departmentId === firstDepartment.id) : undefined;
                    
                    setAcceptanceFormData({
                        branchId: firstBranchId,
                        departmentId: firstDepartment?.id || 0,
                        jobTitleId: firstJobTitle?.id || 0,
                        paymentType: 'monthly',
                        salaryCurrency: 'SYP',
                        agreedDailyHours: 8,
                        monthlySalary: 0,
                        weeklySalary: 0,
                        hourlyRate: 0,
                        overtimeRate: 0,
                        checkInStartTime: '08:00',
                        checkInEndTime: '09:00',
                        checkOutStartTime: '17:00',
                        checkOutEndTime: '18:00',
                    });
    
                    setIsModalOpen(false);
                    setIsAcceptanceModalOpen(true);
                } catch (error: any) {
                    console.error("Error creating initial job application before acceptance:", error);
                    setToast({ message: `فشل في إنشاء الطلب المبدئي: ${error.message}`, type: 'error' });
                }
            } else { // Normal creation
                await api.db.insert('jobApplications', formData);
                setToast({ message: 'تم إضافة طلب التوظيف بنجاح.', type: 'success' });
                await refreshData();
                setIsModalOpen(false);
            }
            return;
        }
    
        // Logic for updating an existing application
        const dataToSubmit = { ...formData, interviewDateTime: formData.status === 'Interview' ? formData.interviewDateTime : null };
    
        if (dataToSubmit.status === 'Accepted' && selectedApplication.status !== 'Accepted' && !selectedApplication.createdEmployeeId) {
            if (branches.length === 0 || departments.length === 0 || jobTitles.length === 0) {
                setToast({ message: 'لا يمكن قبول الطلب. يرجى إضافة فرع وقسم ومسمى وظيفي واحد على الأقل في الإعدادات أولاً.', type: 'error' });
                return;
            }
            
            setApplicationToAccept({ ...selectedApplication, ...dataToSubmit });
    
            const firstBranchId = branches[0].id;
            const firstDepartment = departments.find(d => d.branchId === firstBranchId);
            const firstJobTitle = firstDepartment ? jobTitles.find(j => j.departmentId === firstDepartment.id) : undefined;
            
            setAcceptanceFormData({
                branchId: firstBranchId,
                departmentId: firstDepartment?.id || 0,
                jobTitleId: firstJobTitle?.id || 0,
                paymentType: 'monthly',
                salaryCurrency: 'SYP',
                agreedDailyHours: 8,
                monthlySalary: 0,
                weeklySalary: 0,
                hourlyRate: 0,
                overtimeRate: 0,
                checkInStartTime: '08:00',
                checkInEndTime: '09:00',
                checkOutStartTime: '17:00',
                checkOutEndTime: '18:00',
            });
            setIsAcceptanceModalOpen(true);
            return;
        }
        
        await api.db.update('jobApplications', selectedApplication.id, dataToSubmit);
    
        if (dataToSubmit.status !== selectedApplication.status) {
            // Automated SMS sending logic here...
        }
    
        await refreshData();
        setIsModalOpen(false);
        setToast({ message: 'تم تحديث طلب التوظيف بنجاح.', type: 'success' });
    };

    const handleConfirmAcceptance = async () => {
        if (!applicationToAccept) return;

        const firstAttachment = applicationToAccept.attachments[0];

        const newEmployeeData = {
            employeeCode: `APP-${Date.now().toString().slice(-6)}`,
            name: applicationToAccept.fullName,
            phone: applicationToAccept.phone,
            address: applicationToAccept.address,
            photo: applicationToAccept.photo || '',
            idPhotoFront: applicationToAccept.idPhotoFront || '',
            idPhotoBack: applicationToAccept.idPhotoBack || '',
            hireDate: new Date().toISOString().split('T')[0],
            status: 'active' as const,
            source: 'recruitment' as const,
            employmentType: applicationToAccept.availability === 'full-time' ? 'contract' : 'freelance',
            employeeNotes: `تم إنشاؤه من طلب توظيف. \nالمؤهلات: ${applicationToAccept.qualifications}\nالكورسات: ${applicationToAccept.trainingCourses}\nملاحظات الطلب: ${applicationToAccept.notes}`,
            cvFile: firstAttachment?.fileData || '',
            cvFileName: firstAttachment?.fileName || '',
            cvFileType: firstAttachment?.fileType || '',
            // From the new acceptance modal
            ...acceptanceFormData
        };

        try {
            const createdEmployee = await api.db.insert('employees', newEmployeeData);
            
            const appUpdateData = {
                ...applicationToAccept,
                status: 'Accepted' as const,
                createdEmployeeId: createdEmployee.id
            };
            await api.db.update('jobApplications', applicationToAccept.id, appUpdateData);

            setToast({ message: 'تم قبول الطلب وإنشاء ملف موظف جديد. يرجى إكمال بياناته في قسم الموظفين.', type: 'success' });
            
            // Send SMS
            const smsText = `تهانينا ${applicationToAccept.fullName}! تم قبول طلبك للوظيفة في شركتنا. سنتواصل معك قريباً لاستكمال إجراءات التوظيف.`;
            api.sms.send({ recipientName: applicationToAccept.fullName, recipientPhone: applicationToAccept.phone, text: smsText, priority: 'HIGH', origin: 'RECRUITMENT' });

            // Close modals and refresh
            setIsAcceptanceModalOpen(false);
            setIsModalOpen(false);
            await refreshData();

        } catch (error: any) {
            console.error("Failed to create employee from application:", error);
            setToast({ message: `فشل إنشاء الموظف: ${error.message}`, type: 'error' });
        }
    };


    const handlePrint = (app: JobApplication) => {
        setPrintData(app);
    };

    const handleExport = (app: JobApplication) => {
        const dataToExport = [
            { key: 'الاسم الكامل', value: app.fullName },
            { key: 'الهاتف', value: app.phone },
            { key: 'العنوان', value: app.address },
            { key: 'تاريخ الميلاد', value: app.dob || '' },
            { key: 'الحالة الاجتماعية', value: app.maritalStatus ? maritalStatusTranslations[app.maritalStatus] : '' },
            { key: 'التفرغ', value: availabilityTranslations[app.availability] },
            { key: 'الحالة', value: statusTranslations[app.status] },
            ...(app.interviewDateTime ? [{ key: 'موعد المقابلة', value: new Date(app.interviewDateTime).toLocaleString('ar-EG') }] : []),
            { key: 'المؤهلات', value: app.qualifications },
            { key: 'الكورسات', value: app.trainingCourses },
            { key: 'ملاحظات', value: app.notes },
            {},
            { key: 'الخبرات' },
            ...app.experiences.flatMap(exp => [
                { key: '  المسمى الوظيفي', value: exp.jobTitle },
                { key: '  الشركة', value: exp.company },
                { key: '  المدة', value: exp.duration },
                { key: '  المسؤوليات', value: exp.responsibilities },
                {}
            ])
        ];
        const ws = XLSX.utils.json_to_sheet(dataToExport, { skipHeader: true });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Application");
        XLSX.writeFile(wb, `application_${app.fullName.replace(/ /g, '_')}.xlsx`);
    };
    
    const filteredAndSortedApplications = useMemo(() => {
        let filtered = jobApplications.filter(app => {
            const searchMatch = app.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || app.phone.includes(searchTerm);
            const statusMatch = filterStatus === 'all' || app.status === filterStatus;
            const availabilityMatch = filterAvailability === 'all' || app.availability === filterAvailability;
            return searchMatch && statusMatch && availabilityMatch;
        });
    
        if (sortConfig) {
            filtered.sort((a, b) => {
                let aValue = (a as any)[sortConfig.key];
                let bValue = (b as any)[sortConfig.key];
    
                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;
                
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
    
        return filtered;
    }, [jobApplications, searchTerm, filterStatus, filterAvailability, sortConfig]);

    const handleBulkExport = () => {
        const dataToExport = filteredAndSortedApplications.map(app => ({
            'الاسم الكامل': app.fullName,
            'رقم الهاتف': app.phone,
            'تاريخ الإنشاء': new Date(app.id).toLocaleDateString('ar-EG'),
            'تاريخ الميلاد': app.dob || '-',
            'العنوان': app.address,
            'التحصيل العلمي': app.qualifications,
            'الحالة': statusTranslations[app.status],
            'التفرغ': availabilityTranslations[app.availability],
            'تاريخ المقابلة': app.interviewDateTime ? new Date(app.interviewDateTime).toLocaleString('ar-EG') : '-',
            'ملاحظات': app.notes
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Applications");
        XLSX.writeFile(wb, "recruitment_list.xlsx");
    };

    return (
        <div className={`p-6 ${printData ? 'is-printing-full-page' : ''}`}>
            <div className="flex justify-between items-center mb-6 no-print">
                <h2 className="text-2xl font-bold text-neutral">طلبات التوظيف</h2>
                <div className="flex gap-2">
                    <button onClick={handleBulkExport} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2">
                        {React.cloneElement(ICONS.export, {className: "h-5 w-5"})} تصدير القائمة
                    </button>
                    <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition">إضافة طلب توظيف</button>
                </div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-md mb-6 no-print flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <input
                        type="text"
                        placeholder="بحث بالاسم أو الهاتف..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="p-2 border rounded-lg bg-white w-72"
                    />
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="p-2 border rounded-lg bg-white">
                        <option value="all">كل الحالات</option>
                        {Object.entries(statusTranslations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                    </select>
                    <select value={filterAvailability} onChange={e => setFilterAvailability(e.target.value as any)} className="p-2 border rounded-lg bg-white">
                        <option value="all">كل أنواع التفرغ</option>
                        {Object.entries(availabilityTranslations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                    </select>
                </div>
                 <div className="relative">
                    <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                        الأعمدة
                    </button>
                    {isColumnSelectorOpen && (
                        <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                            {allColumns.map(col => (
                                <label key={col.key} className="flex items-center px-3 py-2 text-sm hover:bg-gray-100">
                                    <input
                                        type="checkbox"
                                        checked={visibleColumns.has(col.key)}
                                        onChange={() => handleColumnToggle(col.key)}
                                        className="ml-2"
                                    />
                                    {col.name}
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="bg-white rounded-xl shadow-md overflow-x-auto no-print">
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            {allColumns.map(col => visibleColumns.has(col.key) && (
                                <th key={col.key} className="py-3 px-6">
                                    {col.sortable ? (
                                        <button onClick={() => requestSort(col.key)} className="font-medium flex items-center gap-1">
                                            {col.name}
                                            <span>{getSortIndicator(col.key)}</span>
                                        </button>
                                    ) : (
                                        col.name
                                    )}
                                </th>
                            ))}
                             <th className="py-3 px-6">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredAndSortedApplications.map(app => (
                            <tr key={app.id}>
                                {allColumns.map(col => {
                                    if (!visibleColumns.has(col.key)) return null;
                                    
                                    let content: React.ReactNode;
                                    switch (col.key) {
                                        case 'fullName': content = app.fullName; break;
                                        case 'phone': content = app.phone; break;
                                        case 'id': content = new Date(app.id).toLocaleDateString('ar-EG'); break;
                                        case 'dob': content = app.dob || '—'; break;
                                        case 'address': content = app.address || '—'; break;
                                        case 'experiences': content = <ul className="text-xs list-disc pr-3">{app.experiences.map((e, i) => e.jobTitle && <li key={i}>{`${e.jobTitle} في ${e.company}`}</li>)}</ul>; break;
                                        case 'availability': content = app.availability ? availabilityTranslations[app.availability] : '—'; break;
                                        case 'status': content = <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${app.status === 'Accepted' ? 'bg-green-100 text-green-800' : app.status === 'Rejected' ? 'bg-red-100 text-red-800' : app.status === 'Interview' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>{statusTranslations[app.status]}</span>; break;
                                        case 'interviewDateTime': content = app.interviewDateTime ? new Date(app.interviewDateTime).toLocaleString('ar-EG') : '—'; break;
                                        case 'notes': content = <p className="max-w-xs truncate" title={app.notes}>{app.notes || '—'}</p>; break;
                                        default: content = (app as any)[col.key] || '—';
                                    }
                                    return <td key={col.key} className="py-4 px-6">{content}</td>;
                                })}
                                 <td className="py-4 px-6 space-x-2 space-x-reverse whitespace-nowrap">
                                    <button onClick={() => handleOpenSmsModal(app)} className="text-sky-600 hover:text-sky-800 p-1" title="إرسال رسالة">{React.cloneElement(ICONS.sms, {className: "h-5 w-5"})}</button>
                                    <button onClick={() => handlePrint(app)} className="text-gray-600 hover:text-gray-800 p-1" title="طباعة الطلب">{React.cloneElement(ICONS.print, {className: "h-5 w-5"})}</button>
                                    <button onClick={() => handleExport(app)} className="text-blue-600 hover:text-blue-800 p-1" title="تصدير Excel">{React.cloneElement(ICONS.export, {className: "h-5 w-5"})}</button>
                                    <button onClick={() => handleEdit(app)} className="text-primary hover:text-primary-dark p-1" title="تعديل">{React.cloneElement(ICONS.edit, {className: "h-5 w-5"})}</button>
                                    <button onClick={() => handleDelete(app.id)} className="text-red-600 hover:text-red-800 p-1" title="حذف">{React.cloneElement(ICONS.delete, { className: "h-5 w-5" })}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <Modal title={selectedApplication ? 'تعديل طلب توظيف' : 'إضافة طلب توظيف'} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="xl" maximizable>
                <form onSubmit={handleSubmit} className="p-2 space-y-4">
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
                                        <img src={`data:image/jpeg;base64,${formData.photo}`} alt="Applicant" className="w-full h-full object-cover" />
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
                                            <button type="button" onClick={() => personalPhotoInputRef.current?.click()} className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs">استيراد</button>
                                        </>
                                    )}
                                </div>
                            </div>
                            {/* ID Front */}
                            <div className="text-center">
                                <h4 className="text-xs font-medium text-gray-700 mb-1">صورة الهوية (الأمام)</h4>
                                <div className="w-full h-32 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-gray-300">
                                    {activeCameraFor === 'idFront' ? <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-full object-cover"/> : formData.idPhotoFront ? <img src={`data:image/jpeg;base64,${formData.idPhotoFront}`} alt="ID Front" className="w-full h-full object-cover" /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>}
                                </div>
                                <input type="file" ref={idPhotoFrontInputRef} onChange={(e) => handleImageChange(e, 'idPhotoFront')} className="hidden" accept="image/*" />
                                 <div className="flex justify-center gap-2 mt-2">
                                    {activeCameraFor === 'idFront' ? ( <> <button type="button" onClick={capturePhoto} className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs">التقاط</button> <button type="button" onClick={() => setActiveCameraFor(null)} className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs">إلغاء</button> </> ) : ( <> <button type="button" onClick={() => setActiveCameraFor('idFront')} className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs">الكاميرا</button> <button type="button" onClick={() => idPhotoFrontInputRef.current?.click()} className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs">استيراد</button> </> )}
                                </div>
                            </div>
                             {/* ID Back */}
                            <div className="text-center">
                                <h4 className="text-xs font-medium text-gray-700 mb-1">صورة الهوية (الخلف)</h4>
                                <div className="w-full h-32 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-gray-300">
                                    {activeCameraFor === 'idBack' ? <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-full object-cover"/> : formData.idPhotoBack ? <img src={`data:image/jpeg;base64,${formData.idPhotoBack}`} alt="ID Back" className="w-full h-full object-cover" /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>}
                                </div>
                                <input type="file" ref={idPhotoBackInputRef} onChange={(e) => handleImageChange(e, 'idPhotoBack')} className="hidden" accept="image/*" />
                                 <div className="flex justify-center gap-2 mt-2">
                                    {activeCameraFor === 'idBack' ? ( <> <button type="button" onClick={capturePhoto} className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs">التقاط</button> <button type="button" onClick={() => setActiveCameraFor(null)} className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs">إلغاء</button> </> ) : ( <> <button type="button" onClick={() => setActiveCameraFor('idBack')} className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs">الكاميرا</button> <button type="button" onClick={() => idPhotoBackInputRef.current?.click()} className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs">استيراد</button> </> )}
                                </div>
                            </div>
                        </div>

                        {/* Fields Column */}
                        <div className="flex-1 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">الاسم الكامل</label>
                                    <input name="fullName" value={formData.fullName} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">رقم الهاتف</label>
                                    <input name="phone" value={formData.phone} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">تاريخ الميلاد</label>
                                    <input name="dob" type="date" value={formData.dob || ''} onChange={handleChange} className="w-full p-2 border rounded-md" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">العنوان</label>
                                    <input name="address" value={formData.address} onChange={handleChange} className="w-full p-2 border rounded-md" />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">الحالة الاجتماعية</label>
                                    <select name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} className="w-full p-2 border rounded-md bg-white">
                                        {Object.entries(maritalStatusTranslations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">التفرغ</label>
                                    <select name="availability" value={formData.availability} onChange={handleChange} className="w-full p-2 border rounded-md bg-white">
                                        {Object.entries(availabilityTranslations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Qualifications & Training */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">المؤهلات العلمية</label>
                                <textarea name="qualifications" value={formData.qualifications} onChange={handleChange} className="w-full p-2 border rounded-md" rows={2}></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">الدورات التدريبية</label>
                                <textarea name="trainingCourses" value={formData.trainingCourses} onChange={handleChange} className="w-full p-2 border rounded-md" rows={2}></textarea>
                            </div>

                            {/* Experiences */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-700">الخبرات العملية</label>
                                    <button type="button" onClick={addExperience} className="text-sm text-blue-600 hover:text-blue-800">+ إضافة خبرة</button>
                                </div>
                                <div className="space-y-3">
                                    {formData.experiences.map((exp, index) => (
                                        <div key={index} className="p-3 bg-gray-50 rounded-lg border relative">
                                            <button type="button" onClick={() => removeExperience(index)} className="absolute top-2 left-2 text-red-500 hover:text-red-700">×</button>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                                                <input name="jobTitle" placeholder="المسمى الوظيفي" value={exp.jobTitle} onChange={(e) => handleExperienceChange(index, e)} className="p-2 border rounded-md text-sm" />
                                                <input name="company" placeholder="الشركة" value={exp.company} onChange={(e) => handleExperienceChange(index, e)} className="p-2 border rounded-md text-sm" />
                                                <input name="duration" placeholder="المدة" value={exp.duration} onChange={(e) => handleExperienceChange(index, e)} className="p-2 border rounded-md text-sm" />
                                            </div>
                                            <textarea name="responsibilities" placeholder="المسؤوليات" value={exp.responsibilities} onChange={(e) => handleExperienceChange(index, e)} className="w-full p-2 border rounded-md text-sm" rows={2}></textarea>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Attachments */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">المرفقات (صور، CV، شهادات)</label>
                                <div className="flex items-center gap-2 mb-2">
                                    <input type="file" ref={attachmentsInputRef} onChange={handleAttachments} className="hidden" multiple />
                                    <button type="button" onClick={() => attachmentsInputRef.current?.click()} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm">رفع ملفات</button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {formData.attachments.map((file, index) => (
                                        <div key={index} className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full text-sm border border-blue-200">
                                            <span className="truncate max-w-[150px]" title={file.fileName}>{file.fileName}</span>
                                            <button type="button" onClick={() => removeAttachment(index)} className="text-red-500 hover:text-red-700 font-bold">×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">ملاحظات إضافية</label>
                                <textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full p-2 border rounded-md" rows={2}></textarea>
                            </div>
                            
                            {selectedApplication && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 mt-2">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">الحالة</label>
                                        <select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border rounded-md bg-white">
                                            {Object.entries(statusTranslations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                                        </select>
                                    </div>
                                    {formData.status === 'Interview' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">موعد المقابلة</label>
                                            <input type="datetime-local" name="interviewDateTime" value={formData.interviewDateTime || ''} onChange={handleChange} className="w-full p-2 border rounded-md" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-4 border-t pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">{selectedApplication ? 'حفظ التعديلات' : 'حفظ الطلب'}</button>
                    </div>
                </form>
            </Modal>

            {/* Accept Application Modal */}
            <Modal title={`قبول طلب توظيف: ${applicationToAccept?.fullName}`} isOpen={isAcceptanceModalOpen} onClose={() => setIsAcceptanceModalOpen(false)} size="large">
               <div className="p-4 space-y-4">
                   <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-3 mb-4">
                       <p className="font-bold">أنت على وشك قبول هذا الموظف!</p>
                       <p>يرجى تحديد البيانات الوظيفية الأساسية لإنشاء ملف الموظف.</p>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                           <label className="block text-sm font-medium mb-1">الفرع</label>
                           <select 
                                value={acceptanceFormData.branchId} 
                                onChange={(e) => setAcceptanceFormData(prev => ({...prev, branchId: Number(e.target.value)}))}
                                className="w-full p-2 border rounded-md"
                           >
                               {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                           </select>
                       </div>
                       <div>
                           <label className="block text-sm font-medium mb-1">القسم</label>
                           <select 
                                value={acceptanceFormData.departmentId} 
                                onChange={(e) => setAcceptanceFormData(prev => ({...prev, departmentId: Number(e.target.value)}))}
                                className="w-full p-2 border rounded-md"
                           >
                               {departments.filter(d => d.branchId === acceptanceFormData.branchId).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                           </select>
                       </div>
                       <div>
                           <label className="block text-sm font-medium mb-1">المسمى الوظيفي</label>
                           <select 
                                value={acceptanceFormData.jobTitleId} 
                                onChange={(e) => setAcceptanceFormData(prev => ({...prev, jobTitleId: Number(e.target.value)}))}
                                className="w-full p-2 border rounded-md"
                           >
                               {jobTitles.filter(j => j.departmentId === acceptanceFormData.departmentId).map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                           </select>
                       </div>
                       <div>
                           <label className="block text-sm font-medium mb-1">نظام الدفع</label>
                           <select 
                                value={acceptanceFormData.paymentType} 
                                onChange={(e) => setAcceptanceFormData(prev => ({...prev, paymentType: e.target.value as any}))}
                                className="w-full p-2 border rounded-md"
                           >
                               <option value="monthly">شهري</option>
                               <option value="weekly">أسبوعي</option>
                               <option value="hourly">ساعات</option>
                           </select>
                       </div>
                       {/* Add salary fields based on payment type if needed, simplistic for now */}
                        <div>
                           <label className="block text-sm font-medium mb-1">الراتب / الأجر</label>
                           <input 
                                type="number" 
                                value={acceptanceFormData.paymentType === 'monthly' ? acceptanceFormData.monthlySalary : acceptanceFormData.paymentType === 'weekly' ? acceptanceFormData.weeklySalary : acceptanceFormData.hourlyRate} 
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if(acceptanceFormData.paymentType === 'monthly') setAcceptanceFormData(prev => ({...prev, monthlySalary: val}));
                                    else if(acceptanceFormData.paymentType === 'weekly') setAcceptanceFormData(prev => ({...prev, weeklySalary: val}));
                                    else setAcceptanceFormData(prev => ({...prev, hourlyRate: val}));
                                }}
                                className="w-full p-2 border rounded-md"
                           />
                       </div>
                   </div>
                   <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                       <button onClick={() => setIsAcceptanceModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-lg">إلغاء</button>
                       <button onClick={handleConfirmAcceptance} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">تأكيد القبول وإنشاء الملف</button>
                   </div>
               </div>
            </Modal>

            <SendSmsModal 
                isOpen={isSmsModalOpen} 
                onClose={() => setIsSmsModalOpen(false)}
                api={api}
                setToast={setToast}
                initialTarget={smsTarget}
            />

            {printData && <PrintableApplication data={printData} />}
        </div>
    );
};

// Reusable Send SMS Modal Component (duplicated here as it's not exported from Employees or elsewhere commonly)
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

export default Recruitment;