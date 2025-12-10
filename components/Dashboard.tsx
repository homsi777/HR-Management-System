import React, { useState, useMemo, useEffect } from 'react';
import { Employee, AttendanceRecord, LeaveRequest, Representative, JobTitle, IElectronAPI, UnmatchedAttendanceRecord, ToastState, MaintenanceStaff, SalaryCurrency, Branch, Department, VisitorQueueEntry, LicenseType, Page } from '../types';
import Card from './ui/Card';
import Modal from './ui/Modal';
import ResolveAttendance from './ResolveAttendance';
import { ICONS } from '../constants';

const leaveTypeTranslations: Record<LeaveRequest['type'], string> = { 'Annual': 'سنوية', 'Sick': 'مرضية', 'Emergency': 'طارئة', 'Unpaid': 'بدون راتب' };
const leaveStatusTranslations: Record<LeaveRequest['status'], string> = { 'Approved': 'موافق عليه', 'Pending': 'قيد الانتظار', 'Rejected': 'مرفوض' };
const salaryCurrencyTranslations: Record<SalaryCurrency, string> = { 'SYP': 'ليرة سوري', 'USD': 'دولار أمريكي', 'TRY': 'ليرة تركي' };

interface DashboardProps {
    employees: Employee[];
    attendance: AttendanceRecord[];
    leaveRequests: LeaveRequest[];
    representatives: Representative[];
    maintenanceStaff: MaintenanceStaff[];
    jobTitles: JobTitle[];
    branches: Branch[];
    departments: Department[];
    unmatchedAttendance: UnmatchedAttendanceRecord[];
    refreshData: () => Promise<void>;
    setToast: (toast: ToastState) => void;
    api: IElectronAPI;
    isSetupComplete: boolean; 
    licenseType: LicenseType;
    cloudSyncEnabled: boolean;
    setActivePage: (page: Page) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ employees, attendance, leaveRequests, representatives, jobTitles, unmatchedAttendance, refreshData, setToast, api, maintenanceStaff, branches, departments, isSetupComplete, licenseType, cloudSyncEnabled, setActivePage }) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const [isRepAttendanceModalOpen, setIsRepAttendanceModalOpen] = useState(false);
    const [selectedRepId, setSelectedRepId] = useState<number | ''>('');
    const [selectedRepInfo, setSelectedRepInfo] = useState({ canCheckIn: false, canCheckOut: false, statusText: '' });
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalContent, setModalContent] = useState<string[]>([]);
    const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
    const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
    const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
    const [visitorName, setVisitorName] = useState('');
    const [queueTicketData, setQueueTicketData] = useState<any | null>(null);
    const [isSyncingCloud, setIsSyncingCloud] = useState(false);
    const [isDownloadingCloud, setIsDownloadingCloud] = useState(false);
    
    const [maintenanceFormData, setMaintenanceFormData] = useState({
        employeeId: '',
        amount: 0,
        currency: 'SYP' as SalaryCurrency,
        notes: ''
    });

    // Check if the current license supports advanced features (Full or Trial)
    const isFullVersion = licenseType === 'Full' || licenseType === 'Trial';

    const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);
    const presentTodayRecords = useMemo(() => attendance.filter(a => a.date === todayStr), [attendance, todayStr]);
    const presentTodayIds = useMemo(() => new Set(presentTodayRecords.map(a => a.employeeId)), [presentTodayRecords]);
    
    const onLeaveTodayList = useMemo(() => 
        leaveRequests.filter(lr => lr.status === 'Approved' && todayStr >= lr.startDate && todayStr <= lr.endDate)
        .map(lr => employees.find(e => e.id === lr.employeeId)).filter((e): e is Employee => !!e), 
    [leaveRequests, todayStr, employees]);
    const onLeaveTodayIds = useMemo(() => new Set(onLeaveTodayList.map(e => e.id)), [onLeaveTodayList]);

    const absentTodayList = useMemo(() => 
        activeEmployees.filter(emp => !presentTodayIds.has(emp.id) && !onLeaveTodayIds.has(emp.id)),
        [activeEmployees, presentTodayIds, onLeaveTodayIds]
    );
    
    const presentTodayList = useMemo(() => 
        activeEmployees.filter(emp => presentTodayIds.has(emp.id)), 
        [activeEmployees, presentTodayIds]
    );

    const representativeIds = useMemo(() => new Set(representatives.map(r => r.employeeId)), [representatives]);
    
    const departedRepresentatives = useMemo(() =>
        attendance.filter(a => a.date === todayStr && a.checkOutType === 'مندوب' && representativeIds.has(a.employeeId))
        .map(a => employees.find(e => e.id === a.employeeId)).filter((e): e is Employee => !!e),
        [attendance, todayStr, employees, representativeIds]
    );
    const departedRepresentativeIds = useMemo(() => new Set(departedRepresentatives.map(r => r.id)), [departedRepresentatives]);

    const presentNowRepresentatives = useMemo(() => {
        return activeEmployees.filter(emp =>
            representativeIds.has(emp.id) &&
            !onLeaveTodayIds.has(emp.id) &&
            !departedRepresentativeIds.has(emp.id)
        );
    }, [activeEmployees, representativeIds, onLeaveTodayIds, departedRepresentativeIds]);

    const activeReps = useMemo(() => 
        activeEmployees.filter(emp => representativeIds.has(emp.id)), 
        [activeEmployees, representativeIds]
    );

    const maintenanceEmployees = useMemo(() => {
        const staffIds = new Set(maintenanceStaff.map(s => s.employeeId));
        return activeEmployees.filter(emp => staffIds.has(emp.id));
    }, [activeEmployees, maintenanceStaff]);

    useEffect(() => {
        if (!selectedRepId) {
            setSelectedRepInfo({ canCheckIn: false, canCheckOut: false, statusText: 'يرجى اختيار مندوب.' });
            return;
        }

        const isOnLeave = onLeaveTodayIds.has(Number(selectedRepId));
        if (isOnLeave) {
            setSelectedRepInfo({ canCheckIn: false, canCheckOut: false, statusText: 'هذا المندوب في إجازة اليوم.' });
            return;
        }

        const todayRecord = attendance.find(a => a.employeeId === Number(selectedRepId) && a.date === todayStr);

        if (!todayRecord) {
            setSelectedRepInfo({ canCheckIn: true, canCheckOut: true, statusText: 'المندوب لم يسجل حضوره بعد.' });
        } else if (todayRecord && !todayRecord.checkOut) {
            setSelectedRepInfo({ canCheckIn: false, canCheckOut: true, statusText: `مسجل دخوله في الساعة ${todayRecord.checkIn}.` });
        } else {
            setSelectedRepInfo({ canCheckIn: false, canCheckOut: false, statusText: `أنهى دوامه. (خروج في ${todayRecord.checkOut})` });
        }
    }, [selectedRepId, attendance, onLeaveTodayIds, todayStr]);

    // Auto-print effect for queue ticket
    useEffect(() => {
        if (queueTicketData) {
            const timer = setTimeout(() => {
                const ticketContent = document.querySelector('.queue-ticket');
                if (ticketContent) {
                    api.app.print({ content: ticketContent.innerHTML });
                }
                setQueueTicketData(null);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [queueTicketData, api.app]);

    const unmatchedRecordsCount = useMemo(() => {
        const uniqueIds = new Set(unmatchedAttendance.map(r => r.biometricId));
        return uniqueIds.size;
    }, [unmatchedAttendance]);

    const getEmployeeName = (employeeId: number) => employees.find(e => e.id === employeeId)?.name || 'Unknown';
    
    const showInfoModal = (title: string, data: Employee[]) => {
        setModalTitle(title);
        setModalContent(data.map(emp => emp.name));
        setIsInfoModalOpen(true);
    };
    
    const handleRepCheckIn = async () => {
        if (!selectedRepId) {
            setToast({ message: 'يرجى اختيار مندوب.', type: 'error' });
            return;
        }
        const now = new Date();
        const checkInTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        await api.db.insert('attendance', {
            employeeId: Number(selectedRepId),
            date: todayStr,
            checkIn: checkInTime,
            checkOut: null
        });

        await refreshData();
        setToast({ message: `تم تسجيل دخول المندوب ${getEmployeeName(Number(selectedRepId))} بنجاح.`, type: 'success' });
        setIsRepAttendanceModalOpen(false);
        setSelectedRepId('');
    };

    const handleRepCheckOut = async () => {
        if (!selectedRepId) {
            setToast({ message: 'يرجى اختيار مندوب.', type: 'error' });
            return;
        }
        const now = new Date();
        const checkOutTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const recordToUpdate = attendance.find(rec => rec.employeeId === selectedRepId && rec.date === todayStr && rec.checkOut === null);

        if (recordToUpdate) {
            await api.db.update('attendance', recordToUpdate.id, {
                checkOut: checkOutTime,
                checkOutType: 'مندوب',
            });
        } else {
            const closedRecordExists = attendance.some(rec => rec.employeeId === selectedRepId && rec.date === todayStr && rec.checkOut !== null);
            if (closedRecordExists) {
                 setToast({ message: 'لا يمكن تسجيل خروج المندوب لأنه لديه سجل حضور مغلق بالفعل لهذا اليوم.', type: 'error' });
                 return;
            }
            
            await api.db.insert('attendance', {
                employeeId: Number(selectedRepId),
                date: todayStr,
                checkIn: '08:00', // Default start time for representatives without a formal check-in
                checkOut: checkOutTime,
                checkOutType: 'مندوب',
            });
        }
        
        await refreshData();
        setToast({ message: `تم تسجيل خروج المندوب ${getEmployeeName(Number(selectedRepId))} بنجاح.`, type: 'success'});
        setIsRepAttendanceModalOpen(false);
        setSelectedRepId('');
    };

    const handleMaintenanceFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        let parsedVal: string | number = value;
        if (name === 'amount') {
            const floatVal = parseFloat(value);
            parsedVal = isNaN(floatVal) ? 0 : floatVal;
        }
        
        setMaintenanceFormData(prev => ({...prev, [name]: parsedVal}));
    };

    const handleMaintenanceRecordSave = async () => {
        if (!maintenanceFormData.employeeId || maintenanceFormData.amount <= 0) {
            setToast({ message: 'الرجاء اختيار موظف وإدخال مبلغ صحيح.', type: 'error' });
            return;
        }
        await api.db.insert('maintenance_records', {
            ...maintenanceFormData,
            employeeId: Number(maintenanceFormData.employeeId),
            date: new Date().toISOString().split('T')[0]
        });
        await refreshData();
        setToast({ message: 'تم حفظ سجل الصيانة بنجاح.', type: 'success' });
        setIsMaintenanceModalOpen(false);
    };

    const handleSaveQueue = async () => {
        if (!visitorName.trim()) {
            setToast({ message: 'يرجى إدخال اسم الزائر.', type: 'error' });
            return;
        }

        const result = await api.app.createVisitorQueue(visitorName);
        
        if (result.success && result.data) {
            setToast({ message: result.message, type: 'success' });
            // Prepare for printing
            const projectNameSetting = await api.db.getSettings('projectName');
            const projectName = projectNameSetting ? JSON.parse(projectNameSetting.value) : 'نظام العالمية';
            
            setQueueTicketData({
                ...result.data,
                projectName
            });
            
            setIsQueueModalOpen(false);
            setVisitorName('');
        } else {
            setToast({ message: result.message, type: 'error' });
        }
    };

    const handleLaunchTool = async (tool: 'zk_pro' | 'timy') => {
        setToast({ message: 'جاري تشغيل الأداة...', type: 'info' });
        const result = await api.app.launchTool(tool);
        setToast({ message: result.message, type: result.success ? 'success' : 'error' });
    };

    const handleSyncToCloud = async () => {
        setIsSyncingCloud(true);
        setToast({ message: 'جاري الاتصال بالسحابة...', type: 'info' });
        try {
            const result = await api.app.syncToCloud();
            setToast({ message: result.message, type: result.success ? 'success' : 'error' });
            if (!result.success && result.message.includes('هوية المركز')) {
                setTimeout(() => setActivePage('settings'), 2000);
            }
        } catch (error: any) {
            setToast({ message: `فشل المزامنة: ${error.message}`, type: 'error' });
        } finally {
            setIsSyncingCloud(false);
        }
    };

    const handleDownloadFromCloud = async () => {
        setIsDownloadingCloud(true);
        setToast({ message: 'جاري جلب البيانات من السحابة...', type: 'info' });
        try {
            const result = await api.app.downloadFromCloud();
            setToast({ message: result.message, type: result.success ? 'success' : 'error' });
            if (result.success && (result.count || 0) > 0) {
                await refreshData();
            }
            if (!result.success && result.message.includes('هوية المركز')) {
                setTimeout(() => setActivePage('settings'), 2000);
            }
        } catch (error: any) {
            setToast({ message: `فشل الجلب: ${error.message}`, type: 'error' });
        } finally {
            setIsDownloadingCloud(false);
        }
    };

    const recentLeaves = useMemo(() => [...leaveRequests].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()).slice(0, 5), [leaveRequests]);

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-6">
                {unmatchedRecordsCount > 0 && (
                    <div onClick={() => setIsResolveModalOpen(true)} className="cursor-pointer lg:col-span-2">
                        <Card title="سجلات حضور غير مطابقة" value={unmatchedRecordsCount} icon={ICONS.unmatched} colorClass="bg-orange-500 animate-pulse" />
                    </div>
                )}
                <div onClick={() => showInfoModal('إجمالي الموظفين النشطين', activeEmployees)} className="cursor-pointer"><Card title="إجمالي الموظفين" value={activeEmployees.length} icon={ICONS.employees} colorClass="bg-blue-500" /></div>
                <div onClick={() => showInfoModal('الحاضرون اليوم', presentTodayList)} className="cursor-pointer"><Card title="الحاضرين اليوم" value={presentTodayIds.size} icon={ICONS.attendance} colorClass="bg-green-500" /></div>
                <div onClick={() => showInfoModal('الموظفون في إجازة اليوم', onLeaveTodayList)} className="cursor-pointer"><Card title="في إجازة اليوم" value={onLeaveTodayIds.size} icon={ICONS.leaves} colorClass="bg-yellow-500" /></div>
                <div onClick={() => showInfoModal('الغائبون اليوم', absentTodayList)} className="cursor-pointer"><Card title="الغائبين اليوم" value={absentTodayList.length} icon={React.cloneElement(ICONS.employees, { className: 'h-6 w-6 transform -scale-x-100' })} colorClass="bg-red-500" /></div>
                
                {/* Stats for Full Version Only */}
                {isFullVersion && (
                    <>
                        <div onClick={() => showInfoModal('المندوبون الحاضرون', presentNowRepresentatives)} className="cursor-pointer"><Card title="المندوبون الحاضرون" value={presentNowRepresentatives.length} icon={ICONS.representativePresent} colorClass="bg-teal-500" /></div>
                        <div onClick={() => showInfoModal('المندوبون المغادرون', departedRepresentatives)} className="cursor-pointer"><Card title="المندوبون المغادرون" value={departedRepresentatives.length} icon={ICONS.representativeDeparted} colorClass="bg-indigo-500" /></div>
                    </>
                )}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md h-full">
                    <h3 className="text-lg font-semibold text-neutral mb-4">طلبات الإجازة الأخيرة</h3>
                    <ul className="space-y-3">
                        {recentLeaves.length > 0 ? recentLeaves.map(leave => (
                            <li key={leave.id} className="py-2 flex justify-between items-center border-b last:border-b-0">
                                <div>
                                    <p className="font-medium text-gray-800">{getEmployeeName(leave.employeeId)}</p>
                                    <p className="text-sm text-gray-500">{leaveTypeTranslations[leave.type]} من {leave.startDate} إلى {leave.endDate}</p>
                                </div>
                                <span className={`px-3 py-1 text-xs font-semibold rounded ${ leave.status === 'Approved' ? 'bg-green-100 text-green-800' : leave.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {leaveStatusTranslations[leave.status]}
                                </span>
                            </li>
                        )) : <p className="text-gray-500">لا توجد طلبات إجازة حديثة.</p>}
                    </ul>
                </div>
                
                {/* Quick Actions Panel */}
                <div className="lg:col-span-1 space-y-6">
                     <div className="bg-white p-6 rounded-xl shadow-md">
                        <h3 className="text-lg font-semibold text-neutral mb-4">إجراءات سريعة</h3>
                        
                        {/* Actions for Full Version Only */}
                        {isFullVersion && (
                            <>
                                <button onClick={() => setIsRepAttendanceModalOpen(true)} className="w-full bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-all duration-300 ease-in-out shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-base font-medium mb-3">
                                    دوام المندوب
                                </button>
                                <button onClick={() => setIsMaintenanceModalOpen(true)} className="w-full bg-cyan-600 text-white px-6 py-3 rounded-lg hover:bg-cyan-700 transition-all duration-300 ease-in-out shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-base font-medium mb-3">
                                    تسجيل صيانة
                                </button>
                                <button onClick={() => setIsQueueModalOpen(true)} className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-all duration-300 ease-in-out shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-base font-medium mb-3">
                                    {React.cloneElement(ICONS.queue, { className: "h-5 w-5" })}
                                    حجز دور
                                </button>
                            </>
                        )}

                        {/* Cloud Sync Buttons (Full Version with sync enabled) */}
                        {isFullVersion && cloudSyncEnabled && (
                            <div className="pt-3 mt-3 border-t border-gray-100">
                                <p className="text-xs text-gray-500 mb-2 font-semibold">المزامنة السحابية</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={handleSyncToCloud} disabled={isSyncingCloud || isDownloadingCloud} className="w-full bg-emerald-600 text-white px-3 py-3 rounded-lg hover:bg-emerald-700 transition-all duration-300 ease-in-out shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm font-medium disabled:bg-gray-400">
                                        {isSyncingCloud ? (
                                            <> <span className="animate-spin h-3 w-3 border-2 border-white rounded-full border-t-transparent"></span> رفع </>
                                        ) : (
                                            <> <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg> رفع </>
                                        )}
                                    </button>
                                    <button onClick={handleDownloadFromCloud} disabled={isSyncingCloud || isDownloadingCloud} className="w-full bg-blue-600 text-white px-3 py-3 rounded-lg hover:bg-blue-700 transition-all duration-300 ease-in-out shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm font-medium disabled:bg-gray-400">
                                        {isDownloadingCloud ? (
                                            <> <span className="animate-spin h-3 w-3 border-2 border-white rounded-full border-t-transparent"></span> جلب </>
                                        ) : (
                                            <> <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" transform="rotate(180 12 12)" /></svg> جلب </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-2 font-semibold">أدوات خارجية</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => handleLaunchTool('zk_pro')} className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition shadow flex items-center justify-center gap-1 text-sm font-bold">
                                    🔧 ZK Pro
                                </button>
                                <button onClick={() => handleLaunchTool('timy')} className="w-full bg-pink-600 text-white px-3 py-2 rounded-lg hover:bg-pink-700 transition shadow flex items-center justify-center gap-1 text-sm font-bold">
                                    🛠️ TIMY
                                </button>
                            </div>
                        </div>
                        
                        {!isFullVersion && (
                            <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-500 border border-dashed border-gray-300">
                                الميزات المتقدمة (المناديب، الصيانة، السحابة) متاحة فقط في النسخة الكاملة.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal title="تسجيل دوام المندوب" isOpen={isRepAttendanceModalOpen} onClose={() => { setIsRepAttendanceModalOpen(false); setSelectedRepId(''); }}>
                <div className="space-y-4">
                    <label htmlFor="rep-select" className="block text-sm font-medium text-gray-700">اختر المندوب:</label>
                    <select 
                        id="rep-select" 
                        value={selectedRepId} 
                        onChange={e => setSelectedRepId(Number(e.target.value))} 
                        className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-primary focus:border-primary"
                    >
                        <option value="" disabled>-- قائمة المناديب النشطين --</option>
                        {activeReps.length > 0 ? activeReps.map(emp => ( <option key={emp.id} value={emp.id}>{emp.name}</option> )) : (<option disabled>لا يوجد مناديب نشطين</option>)}
                    </select>
                    
                    {selectedRepId && (
                        <div className="p-3 bg-gray-50 rounded-md text-sm text-center text-gray-700">
                            {selectedRepInfo.statusText}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
                        <button 
                            type="button" 
                            onClick={() => { setIsRepAttendanceModalOpen(false); setSelectedRepId(''); }} 
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                        >
                            إلغاء
                        </button>
                        <button 
                            onClick={handleRepCheckIn} 
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed" 
                            disabled={!selectedRepInfo.canCheckIn}
                        >
                            تسجيل دخول
                        </button>
                        <button 
                            onClick={handleRepCheckOut} 
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed" 
                            disabled={!selectedRepInfo.canCheckOut}
                        >
                            تسجيل خروج
                        </button>
                    </div>
                </div>
            </Modal>
            
            <Modal title="تسجيل مبلغ مستلم - صيانة" isOpen={isMaintenanceModalOpen} onClose={() => setIsMaintenanceModalOpen(false)}>
                 <div className="space-y-4 p-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">اختر الموظف (فني الصيانة)</label>
                        <select name="employeeId" value={maintenanceFormData.employeeId} onChange={handleMaintenanceFormChange} className="w-full p-2 border rounded-md bg-white" required>
                            <option value="" disabled>-- اختر موظف --</option>
                            {maintenanceEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
                            <input name="amount" type="number" step="any" min="0" value={maintenanceFormData.amount || ''} onChange={handleMaintenanceFormChange} className="w-full p-2 border rounded-md" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">العملة</label>
                            <select name="currency" value={maintenanceFormData.currency} onChange={handleMaintenanceFormChange} className="w-full p-2 border rounded-md bg-white">
                                <option value="SYP">ليرة سوري</option>
                                <option value="USD">دولار أمريكي</option>
                                <option value="TRY">ليرة تركي</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                        <textarea name="notes" value={maintenanceFormData.notes} onChange={handleMaintenanceFormChange} rows={2} className="w-full p-2 border rounded-md"></textarea>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button onClick={() => setIsMaintenanceModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-lg">إلغاء</button>
                        <button onClick={handleMaintenanceRecordSave} className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700">حفظ</button>
                    </div>
                 </div>
            </Modal>

            <Modal title="حجز دور جديد" isOpen={isQueueModalOpen} onClose={() => setIsQueueModalOpen(false)}>
                <div className="space-y-4 p-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">اسم الزائر</label>
                        <input value={visitorName} onChange={e => setVisitorName(e.target.value)} className="w-full p-2 border rounded-md" placeholder="الاسم الثلاثي" />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button onClick={() => setIsQueueModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-lg">إلغاء</button>
                        <button onClick={handleSaveQueue} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">حجز وطباعة</button>
                    </div>
                </div>
            </Modal>

            <Modal title={modalTitle} isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
                <div className="p-4 max-h-96 overflow-y-auto">
                    {modalContent.length > 0 ? (
                        <ul className="space-y-2">
                            {modalContent.map((name, idx) => (
                                <li key={idx} className="p-2 bg-gray-50 rounded border-b last:border-b-0">{name}</li>
                            ))}
                        </ul>
                    ) : <p className="text-center text-gray-500">لا توجد بيانات.</p>}
                </div>
                <div className="flex justify-end p-4 border-t">
                    <button onClick={() => setIsInfoModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-lg">إغلاق</button>
                </div>
            </Modal>

            {isResolveModalOpen && (
                <Modal title="مطابقة سجلات الحضور" isOpen={isResolveModalOpen} onClose={() => setIsResolveModalOpen(false)} size="large">
                    <ResolveAttendance unmatchedAttendance={unmatchedAttendance} employees={employees} api={api} refreshData={refreshData} setToast={setToast} onClose={() => setIsResolveModalOpen(false)} />
                </Modal>
            )}

            {/* Queue Ticket Print Template (Hidden) */}
            {queueTicketData && (
                <div className="queue-ticket hidden">
                    <div className="queue-project-name">{queueTicketData.projectName}</div>
                    <div className="queue-label">رقم الدور</div>
                    <div className="queue-number">{queueTicketData.queueNumber}</div>
                    <div className="queue-time">{queueTicketData.date} - {queueTicketData.time}</div>
                    <div className="queue-footer">
                        <p>الاسم: {queueTicketData.visitorName}</p>
                        <p>يرجى الانتظار حتى يتم استدعاء رقمك</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;