import React, { useState, useEffect, useCallback } from 'react';

import type { Page, Employee, AttendanceRecord, LeaveRequest, SalaryAdvance, Bonus, User, Device, Branch, Department, JobTitle, ToastState, SyncSchedule, Representative, IElectronAPI, UnmatchedAttendanceRecord, ServiceStatus, Payment, Custody, PrintSettings, JobApplication, PhoneBookCategory, PhoneBookContact, SMSMessage, Deduction, Termination, LeaveWorkPayment, MaintenanceStaff, MaintenanceRecord, Client, Interest, ClientTask, LicenseType, BlockedBiometricId, ManufacturingStaff, ManufacturingMaterial } from './types';

// Import Components
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Employees from './components/Employees';
import Representatives from './components/Representatives';
import Maintenance from './components/Maintenance';
import Manufacturing from './components/Manufacturing';
import Attendance from './components/Attendance';
import Leaves from './components/Leaves';
import SalaryAdvances from './components/SalaryAdvances';
import Bonuses from './components/Bonuses';
import Payroll from './components/Payroll';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Toast from './components/ui/Toast';
import LoginScreen from './components/LoginScreen';
import SplashScreen from './components/SplashScreen';
import AiAssistant from './components/AiAssistant';
import FooterBanner from './components/ui/FooterBanner';
import AlertBanner from './components/ui/AlertBanner';
import CustodyComponent from './components/Custody';
import Recruitment from './components/Recruitment';
import PhoneBook from './components/PhoneBook';
import SmsGateway from './components/SmsGateway';
import Clients from './components/Clients';
import SetupWizard from './components/SetupWizard'; 
import ForcedActivation from './components/ForcedActivation';
import mockApi from './data/mockApi';
import capacitorApi from './data/capacitorApi';
import { Capacitor } from '@capacitor/core';

const isElectron = !!window.electronAPI;
const isCapacitor = Capacitor.isNativePlatform();
const api: IElectronAPI = isElectron ? window.electronAPI : (isCapacitor ? capacitorApi : mockApi);

const safeJsonParse = (value: string | null | undefined, fallback: any = null) => {
    if (value === null || value === undefined) return fallback;
    try {
        // This will correctly parse "true", "1", "[1,2]", "{\"a\":1}", and "\"Full\""
        return JSON.parse(value);
    } catch (e) {
        // This handles unquoted strings like Full, or other malformed JSON
        return value;
    }
};

const defaultPrintSettings: PrintSettings = {
    template: 'template1',
    companyName: 'اسم الشركة',
    address: 'العنوان',
    phone: 'رقم الهاتف',
    receiptTitle: 'إيصال',
    companyLogo: ''
};

const App: React.FC = () => {
    // App state
    const [isSplash, setIsSplash] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activePage, setActivePage] = useState<Page>('dashboard');
    const [toast, setToast] = useState<ToastState | null>(null);
    const [projectName, setProjectName] = useState('نظام إدارة الموارد البشرية');
    const [projectLogo, setProjectLogo] = useState('../img/logo.png');
    
    // setupCompleted: null = loading, false = show wizard, true = normal app
    const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null); 

    // Data state
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [salaryAdvances, setSalaryAdvances] = useState<SalaryAdvance[]>([]);
    const [bonuses, setBonuses] = useState<Bonus[]>([]);
    const [deductions, setDeductions] = useState<Deduction[]>([]);
    const [terminations, setTerminations] = useState<Termination[]>([]);
    const [devices, setDevices] = useState<Device[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [representatives, setRepresentatives] = useState<Representative[]>([]);
    const [maintenanceStaff, setMaintenanceStaff] = useState<MaintenanceStaff[]>([]);
    const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
    const [manufacturingStaff, setManufacturingStaff] = useState<ManufacturingStaff[]>([]);
    const [manufacturingMaterials, setManufacturingMaterials] = useState<ManufacturingMaterial[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [custody, setCustody] = useState<Custody[]>([]);
    const [jobApplications, setJobApplications] = useState<JobApplication[]>([]);
    const [unmatchedAttendance, setUnmatchedAttendance] = useState<UnmatchedAttendanceRecord[]>([]);
    const [unmatchedCount, setUnmatchedCount] = useState(0);
    const [phoneBookCategories, setPhoneBookCategories] = useState<PhoneBookCategory[]>([]);
    const [phoneBookContacts, setPhoneBookContacts] = useState<PhoneBookContact[]>([]);
    const [smsLog, setSmsLog] = useState<SMSMessage[]>([]);
    const [leaveWorkPayments, setLeaveWorkPayments] = useState<LeaveWorkPayment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [interests, setInterests] = useState<Interest[]>([]);
    const [clientTasks, setClientTasks] = useState<ClientTask[]>([]);
    const [blockedIds, setBlockedIds] = useState<BlockedBiometricId[]>([]);
    
    // Settings State
    const [workdays, setWorkdays] = useState<number[]>([]);
    const [syncSchedule, setSyncSchedule] = useState<SyncSchedule>({ enabled: false, time: '02:00' });
    const [printSettings, setPrintSettings] = useState<PrintSettings | null>(defaultPrintSettings);
    
    // AI Assistant Modal
    const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);

    // Activation State
    const [isActivated, setIsActivated] = useState(false);
    const [licenseType, setLicenseType] = useState<LicenseType>('Trial'); // Default to Trial until loaded
    const [isTrialExpired, setIsTrialExpired] = useState(false);
    const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);
    const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);

    // System Status
    const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);

    // File Import State
    const [detectedImportFile, setDetectedImportFile] = useState<string | null>(null);

    // Initial load to check setup status and project settings
    useEffect(() => {
        const loadInitialState = async () => {
            try {
                const [nameSetting, logoSetting, setupSetting] = await Promise.all([
                    api.db.getSettings('projectName'),
                    api.db.getSettings('projectLogo'),
                    api.db.getSettings('setupCompleted')
                ]);
                
                if (nameSetting?.value) setProjectName(safeJsonParse(nameSetting.value, 'نظام إدارة الموارد البشرية'));
                if (logoSetting?.value) setProjectLogo(safeJsonParse(logoSetting.value, '../img/logo.png'));
                
                // Check setup status
                const isSetup = setupSetting ? safeJsonParse(setupSetting.value, false) : false;
                setIsSetupComplete(isSetup);

            } catch (error) {
                console.error("Failed to load initial settings:", error);
                setIsSetupComplete(false); // Default to false on error to be safe
            }
        };
        loadInitialState();
    }, []);

    const refreshData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [
                employeesData, attendanceData, leaveRequestsData, salaryAdvancesData, bonusesData,
                devicesData, branchesData, departmentsData, jobTitlesData, usersData,
                representativesData, paymentsData, custodyData, jobApplicationsData,
                unmatchedAttendanceData, workdaysSetting, syncScheduleSetting, printSettingsSetting, 
                isActivatedSetting, installDateSetting, isTrialSetting, licenseTypeSetting,
                phoneBookCategoriesData, phoneBookContactsData, smsLogData, deductionsData, terminationsData, leaveWorkPaymentsData,
                maintenanceStaffData, maintenanceRecordsData, manufacturingStaffData, manufacturingMaterialsData, clientsData, interestsData, clientTasksData,
                cloudSyncEnabledSetting, blockedIdsData
            ] = await Promise.all([
                api.db.getAll('employees'), api.db.getAll('attendance'), api.db.getAll('leaveRequests'),
                api.db.getAll('salaryAdvances'), api.db.getAll('bonuses'), api.db.getAll('devices'), api.db.getAll('branches'),
                api.db.getAll('departments'), api.db.getAll('jobTitles'), api.db.getAll('users'),
                api.db.getAll('representatives'), api.db.getAll('payments'), 
                api.db.getAll('custody'), api.db.getAll('jobApplications'), api.db.getAll('unmatched_attendance'),
                api.db.getSettings('workdays'), api.db.getSettings('syncSchedule'), api.db.getSettings('printSettings'),
                api.db.getSettings('isActivated'), api.db.getSettings('installDate'), api.db.getSettings('isTrial'), api.db.getSettings('licenseType'),
                api.db.getAll('phone_book_categories'), api.db.getAll('phone_book_contacts'),
                api.sms.getLog(), api.db.getAll('deductions'), api.db.getAll('terminations'),
                api.db.getAll('leave_work_payments'), api.db.getAll('maintenance_staff'), api.db.getAll('maintenance_records'), 
                api.db.getAll('manufacturing_staff'), api.db.getAll('manufacturing_materials'),
                api.db.getAll('clients'), api.db.getAll('interests'), api.db.getAll('client_tasks'),
                api.db.getSettings('cloudSyncEnabled'), api.db.getAll('blocked_biometric_ids')
            ]);
            
            setEmployees(employeesData); setAttendance(attendanceData); setLeaveRequests(leaveRequestsData);
            setSalaryAdvances(salaryAdvancesData); setBonuses(bonusesData); setDevices(devicesData); setBranches(branchesData);
            setDepartments(departmentsData); setJobTitles(jobTitlesData); setUsers(usersData);
            setRepresentatives(representativesData); setPayments(paymentsData);
            setCustody(custodyData); setJobApplications(jobApplicationsData);
            setUnmatchedAttendance(unmatchedAttendanceData);
            setPhoneBookCategories(phoneBookCategoriesData);
            setPhoneBookContacts(phoneBookContactsData);
            setSmsLog(smsLogData);
            setDeductions(deductionsData);
            setTerminations(terminationsData);
            setLeaveWorkPayments(leaveWorkPaymentsData);
            setMaintenanceStaff(maintenanceStaffData);
            setMaintenanceRecords(maintenanceRecordsData);
            setManufacturingStaff(manufacturingStaffData);
            setManufacturingMaterials(manufacturingMaterialsData);
            setClients(clientsData);
            setInterests(interestsData);
            setClientTasks(clientTasksData);
            setBlockedIds(blockedIdsData);

            const uniqueUnmatchedIds = new Set(unmatchedAttendanceData.map(r => r.biometricId));
            setUnmatchedCount(uniqueUnmatchedIds.size);
            
            if (workdaysSetting) setWorkdays(safeJsonParse(workdaysSetting.value, []));
            if (syncScheduleSetting) setSyncSchedule(safeJsonParse(syncScheduleSetting.value, { enabled: false, time: '02:00' }));
            if (printSettingsSetting) setPrintSettings(safeJsonParse(printSettingsSetting.value, defaultPrintSettings)); else setPrintSettings(defaultPrintSettings);

            const activated = isActivatedSetting ? safeJsonParse(isActivatedSetting.value, false) : false;
            setIsActivated(activated);
            
            const type = licenseTypeSetting ? safeJsonParse(licenseTypeSetting.value, 'Trial') : 'Trial';
            setLicenseType(type);

            const isTrial = isTrialSetting ? safeJsonParse(isTrialSetting.value, false) : false;

            if (cloudSyncEnabledSetting) setCloudSyncEnabled(safeJsonParse(cloudSyncEnabledSetting.value, false));

            if (!activated && isTrial) {
                const installDate = installDateSetting ? new Date(safeJsonParse(installDateSetting.value)) : new Date();
                const now = new Date();
                const daysPassed = Math.floor((now.getTime() - installDate.getTime()) / (1000 * 3600 * 24));
                const trialDuration = 4; // Trial duration set to 4 days
                const remaining = trialDuration - daysPassed; 
                setTrialDaysRemaining(Math.max(0, remaining));
                if (remaining <= 0) setIsTrialExpired(true);
            } else if (!activated && !isTrial) {
                setIsTrialExpired(true);
                setTrialDaysRemaining(0);
            } else {
                setIsTrialExpired(false);
            }

        } catch (error) {
            console.error("Failed to refresh data:", error);
            setToast({ message: 'فشل في تحميل البيانات.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isLoggedIn) {
            refreshData();
        }
    }, [isLoggedIn, refreshData]);

    useEffect(() => {
        if (isElectron && api.app.onDatabaseUpdate) {
            const removeListener = api.app.onDatabaseUpdate(() => {
                console.log('Database updated externally. Refreshing data...');
                refreshData();
            });

            return () => {
                if (removeListener) removeListener();
            };
        }
    }, [isElectron, refreshData]);

    useEffect(() => {
        if (isElectron && api.app.onSystemEvent) {
            const removeListener = api.app.onSystemEvent((event) => {
                if (event && event.message) {
                    setToast({
                        message: event.message,
                        type: event.type || 'success'
                    });
                }
            });
            return () => {
                if (removeListener) removeListener();
            };
        }
    }, [isElectron]);

    useEffect(() => {
        if (isElectron && api.app.onSystemStatusUpdate) {
            const removeListener = api.app.onSystemStatusUpdate((status) => {
                setServiceStatus(status);
            });
            return () => {
                if (removeListener) removeListener();
            };
        }
    }, [isElectron]);

    // Listen for file detection events
    useEffect(() => {
        if (isElectron && api.app.onFileDetected) {
            const removeListener = api.app.onFileDetected((filename) => {
                setDetectedImportFile(filename);
            });
            return () => {
                if (removeListener) removeListener();
            }
        }
    }, [isElectron]);


    const handleLogin = async (username: string, password: string) => {
        const result = await api.auth.login(username, password);
        if (result.success && result.user) {
            setUser(result.user);
            setIsLoggedIn(true);
        } else {
            setToast({ message: result.message, type: 'error' });
        }
    };
    
    const showToast = (toastConfig: ToastState) => {
        setToast(toastConfig);
    };
    
    const handleResolveFromBanner = () => {
        setActivePage('dashboard');
    };

    const handleProcessImport = async () => {
        if (!detectedImportFile) return;
        
        setToast({ message: 'جاري استيراد الملف...', type: 'info' });
        const result = await api.app.processImportFile(detectedImportFile);
        setToast({ message: result.message, type: result.success ? 'success' : 'error' });
        setDetectedImportFile(null); // Hide banner
        if (result.success) {
            refreshData();
        }
    };

    const handleSetupComplete = async () => {
        setIsSetupComplete(true);
        setToast({ message: 'تم إعداد النظام. الرجاء تسجيل الدخول.', type: 'success' });
        await refreshData();
    };

    const handleActivationSuccess = async () => {
        await refreshData();
    };

    const renderPage = () => {
        // Prevent access to pages not available in current license
        // Simple client-side guard, though Navbar handles visibility
        if (licenseType === 'Lite' && !['dashboard', 'recruitment', 'employees', 'attendance', 'settings'].includes(activePage)) {
            return <div className="p-10 text-center">عذراً، هذا القسم غير متوفر في النسخة Lite.</div>;
        }
        if (licenseType === 'Pro' && ['bonuses', 'custody', 'clients', 'representatives', 'maintenance', 'phoneBook', 'sms', 'manufacturing'].includes(activePage)) {
             return <div className="p-10 text-center">عذراً، هذا القسم غير متوفر في النسخة Pro.</div>;
        }

        switch (activePage) {
            case 'dashboard': return <Dashboard employees={employees} attendance={attendance} leaveRequests={leaveRequests} representatives={representatives} jobTitles={jobTitles} unmatchedAttendance={unmatchedAttendance} refreshData={refreshData} setToast={showToast} api={api} maintenanceStaff={maintenanceStaff} branches={branches} departments={departments} isSetupComplete={isSetupComplete === true} licenseType={licenseType} cloudSyncEnabled={cloudSyncEnabled} setActivePage={setActivePage} />;
            case 'employees': return <Employees employees={employees} departments={departments} branches={branches} jobTitles={jobTitles} devices={devices} workdays={workdays} leaveRequests={leaveRequests} attendance={attendance} salaryAdvances={salaryAdvances} bonuses={bonuses} deductions={deductions} refreshData={refreshData} setToast={showToast} api={api} maintenanceRecords={maintenanceRecords} maintenanceStaff={maintenanceStaff} />;
            case 'clients': return <Clients clients={clients} interests={interests} clientTasks={clientTasks} refreshData={refreshData} setToast={showToast} api={api} />;
            case 'representatives': return <Representatives representatives={representatives} employees={employees} departments={departments} refreshData={refreshData} setToast={showToast} api={api} />;
            case 'maintenance': return <Maintenance maintenanceStaff={maintenanceStaff} employees={employees} departments={departments} refreshData={refreshData} setToast={showToast} api={api} />;
            case 'manufacturing': return <Manufacturing manufacturingStaff={manufacturingStaff} employees={employees} materials={manufacturingMaterials} refreshData={refreshData} setToast={showToast} api={api} />;
            case 'attendance': return <Attendance attendance={attendance} employees={employees} refreshData={refreshData} api={api} />;
            case 'leaves': return <Leaves leaveRequests={leaveRequests} employees={employees} jobTitles={jobTitles} refreshData={refreshData} api={api} printSettings={printSettings} leaveWorkPayments={leaveWorkPayments} setToast={showToast} />;
            case 'advances': return <SalaryAdvances salaryAdvances={salaryAdvances} employees={employees} jobTitles={jobTitles} refreshData={refreshData} api={api} printSettings={printSettings} setToast={showToast} />;
            case 'bonuses': return <Bonuses bonuses={bonuses} deductions={deductions} employees={employees} refreshData={refreshData} setToast={showToast} api={api} printSettings={printSettings} />;
            case 'payroll': return <Payroll employees={employees} attendance={attendance} salaryAdvances={salaryAdvances} bonuses={bonuses} deductions={deductions} departments={departments} payments={payments} api={api} setToast={showToast} refreshData={refreshData} workdays={workdays} jobTitles={jobTitles} printSettings={printSettings} leaveRequests={leaveRequests} manufacturingStaff={manufacturingStaff} />;
            case 'custody': return <CustodyComponent custody={custody} employees={employees} refreshData={refreshData} setToast={showToast} api={api} />;
            case 'recruitment': return <Recruitment jobApplications={jobApplications} refreshData={refreshData} setToast={showToast} api={api} branches={branches} departments={departments} jobTitles={jobTitles} />;
            case 'reports': return <Reports clients={clients} clientTasks={clientTasks} employees={employees} attendance={attendance} leaveRequests={leaveRequests} salaryAdvances={salaryAdvances} bonuses={bonuses} deductions={deductions} departments={departments} jobTitles={jobTitles} workdays={workdays} payments={payments} custody={custody} terminations={terminations} api={api} setToast={showToast} maintenanceStaff={maintenanceStaff} maintenanceRecords={maintenanceRecords}/>;
            case 'phoneBook': return <PhoneBook categories={phoneBookCategories} contacts={phoneBookContacts} refreshData={refreshData} setToast={showToast} api={api} />;
            case 'sms': return <SmsGateway smsLog={smsLog} employees={employees} contacts={phoneBookContacts} api={api} refreshData={refreshData} setToast={showToast} />;
            case 'settings': return <Settings 
                devices={devices} branches={branches} departments={departments} jobTitles={jobTitles} users={users} employees={employees}
                syncSchedule={syncSchedule} workdays={workdays} refreshData={refreshData} setToast={showToast} nextSyncTime={null}
                isActivated={isActivated} isTrialExpired={isTrialExpired} trialDaysRemaining={trialDaysRemaining}
                printSettings={printSettings}
                api={api}
                licenseType={licenseType}
                cloudSyncEnabled={cloudSyncEnabled}
                blockedIds={blockedIds}
            />;
            default: return <Dashboard employees={employees} attendance={attendance} leaveRequests={leaveRequests} representatives={representatives} jobTitles={jobTitles} unmatchedAttendance={unmatchedAttendance} refreshData={refreshData} setToast={showToast} api={api} maintenanceStaff={maintenanceStaff} branches={branches} departments={departments} isSetupComplete={isSetupComplete === true} licenseType={licenseType} cloudSyncEnabled={cloudSyncEnabled} setActivePage={setActivePage} />;
        }
    };

    // 1. Splash Screen
    if (isSplash) {
        return <SplashScreen onStart={() => setIsSplash(false)} projectName={projectName} projectLogo={projectLogo} />;
    }

    // 2. Setup Wizard
    if (isSetupComplete === false) {
        return <SetupWizard isOpen={true} api={api} onComplete={handleSetupComplete} setToast={showToast} />;
    }

    // 3. Login Screen
    if (!isLoggedIn) {
        return (
            <>
                <LoginScreen onLogin={handleLogin} projectName={projectName} projectLogo={projectLogo} />
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </>
        );
    }

    // 4. BLOCKING SCREEN if trial expired and not activated
    if (!isActivated && isTrialExpired) {
        return (
            <>
                <ForcedActivation api={api} setToast={showToast} onSuccess={handleActivationSuccess} />
                <div className="flex items-center justify-center min-h-screen bg-gray-100 blur-sm pointer-events-none select-none">
                    <h1 className="text-2xl text-gray-400">التطبيق متوقف</h1>
                </div>
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </>
        );
    }

    // 5. Main App
    const footerHeight = (!isActivated ? 40 : 0) + (serviceStatus ? 28 : 0);

    return (
        <div dir="rtl" className="flex flex-col h-screen bg-transparent font-tajawal">
            <Navbar 
                activePage={activePage} 
                setActivePage={setActivePage} 
                onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
                jobApplications={jobApplications}
                user={user}
                projectName={projectName}
                licenseType={licenseType}
            />
            {detectedImportFile && (
                 <div className="bg-indigo-100 border-b-4 border-indigo-500 text-indigo-900 px-4 py-3 shadow-md flex justify-between items-center no-print z-40">
                    <div className="flex items-center">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                            <p className="font-bold">تم اكتشاف ملف استيراد جديد</p>
                            <p className="text-sm">{detectedImportFile}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleProcessImport} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold transition">استيراد الآن</button>
                        <button onClick={() => setDetectedImportFile(null)} className="text-indigo-500 hover:text-indigo-700 px-3 py-2">تجاهل</button>
                    </div>
                </div>
            )}

            {unmatchedCount > 0 && (
                <AlertBanner count={unmatchedCount} onResolveClick={handleResolveFromBanner} />
            )}
            <main className="flex-1 overflow-y-auto relative" style={{ paddingBottom: `${footerHeight}px` }}>
                {renderPage()}
                
                {isLoading && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="flex items-center gap-3 text-lg font-semibold text-neutral">
                           <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>جاري تحميل البيانات...</span>
                        </div>
                    </div>
                )}
            </main>

            <FooterBanner 
                isActivated={isActivated} 
                daysRemaining={trialDaysRemaining} 
                isExpired={isTrialExpired} 
                onActivate={() => setActivePage('settings')}
                status={serviceStatus}
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <AiAssistant 
                isOpen={isAiAssistantOpen} 
                onClose={() => setIsAiAssistantOpen(false)}
                employees={employees}
                attendance={attendance}
                leaveRequests={leaveRequests}
                departments={departments}
                jobTitles={jobTitles}
                branches={branches}
                salaryAdvances={salaryAdvances}
                bonuses={bonuses}
                deductions={deductions}
            />
        </div>
    );
};

export default App;