
import React, { useState } from 'react';
import { IElectronAPI, LicenseType, Governorate, CenterRole } from '../types';
import { ICONS } from '../constants';

interface SetupWizardProps {
    isOpen: boolean;
    api: IElectronAPI;
    onComplete: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
}

const governorates: { id: Governorate, name: string }[] = [
    { id: 'RifDimashq', name: 'ريف دمشق' },
    { id: 'Aleppo', name: 'حلب' },
    { id: 'Homs', name: 'حمص' },
    { id: 'Hama', name: 'حماة' },
    { id: 'Latakia', name: 'اللاذقية' },
    { id: 'Tartus', name: 'طرطوس' },
    { id: 'Idlib', name: 'إدلب' },
    { id: 'Daraa', name: 'درعا' },
    { id: 'Suwayda', name: 'السويداء' },
    { id: 'Quneitra', name: 'القنيطرة' },
    { id: 'DeirEzZor', name: 'دير الزور' },
    { id: 'Hasakah', name: 'الحسكة' },
    { id: 'Raqqa', name: 'الرقة' },
];

const SetupWizard: React.FC<SetupWizardProps> = ({ isOpen, api, onComplete, setToast }) => {
    const [step, setStep] = useState(1);
    
    // Data Storage for subsequent steps
    const [createdIds, setCreatedIds] = useState({ branchId: 0, departmentId: 0 });

    // --- Step 1 States ---
    const [selectedPlan, setSelectedPlan] = useState<LicenseType | null>(null);
    const [selectedGovernorate, setSelectedGovernorate] = useState<Governorate | ''>('');
    const [activationCode, setActivationCode] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    
    // --- Cloud Config States (only for Full) ---
    const [cloudConfig, setCloudConfig] = useState({
        enabled: true,
        role: 'duplex' as CenterRole,
        numberOfCenters: 1,
    });

    // --- Step 2+ States ---
    const [adminData, setAdminData] = useState({ username: '', password: '' });
    const [companyName, setCompanyName] = useState('');
    // Use random code to prevent UNIQUE constraint errors
    const [branchData, setBranchData] = useState({ name: '', branchCode: `BR-${Math.floor(1000 + Math.random() * 9000)}`, address: '' });
    const [deptData, setDeptData] = useState({ name: '' });
    const [jobTitlesList, setJobTitlesList] = useState<Array<{name: string, description: string}>>([]);
    const [currentJob, setCurrentJob] = useState({ name: '', description: '' });

    if (!isOpen) return null;

    const handleVerifyAndContinue = async () => {
        setIsProcessing(true);

        if (!selectedPlan) {
            setToast({ message: 'يرجى اختيار خطة التفعيل أولاً.', type: 'error' });
            setIsProcessing(false);
            return;
        }

        if (!activationCode || !selectedGovernorate) {
            setToast({ message: 'يرجى اختيار المحافظة وإدخال الرمز.', type: 'error' });
            setIsProcessing(false);
            return;
        }
        
        const result = await api.app.verifyActivationCode({ code: activationCode, type: selectedPlan }); 
        
        if (!result.success) {
            setToast({ message: result.message || 'رمز التفعيل غير صالح.', type: 'error' });
            setIsProcessing(false);
            return;
        }

        const typeChar = activationCode.charAt(3).toUpperCase();
        const detectedType: LicenseType | null = typeChar === 'L' ? 'Lite' : typeChar === 'P' ? 'Pro' : typeChar === 'F' ? 'Full' : null;

        if (detectedType !== selectedPlan) {
            setToast({ message: `رمز التفعيل الذي أدخلته مخصص لنسخة ${detectedType}، وليس ${selectedPlan}.`, type: 'error' });
            setIsProcessing(false);
            return;
        }

        setToast({ message: result.message, type: 'success' });
        
        // Save cloud settings if Full version was activated
        if (selectedPlan === 'Full') {
            await api.db.updateSettings('cloudSyncEnabled', cloudConfig.enabled);
            if (cloudConfig.enabled) {
                await api.db.updateSettings('centerRole', cloudConfig.role);
                await api.db.updateSettings('numberOfCenters', cloudConfig.numberOfCenters);
            }
        }
        
        // Move to the next step
        setStep(2);
        setIsProcessing(false);
    };
    
    const handleStartTrial = async () => {
        await api.db.updateSettings('isTrial', true);
        await api.db.updateSettings('licenseType', 'Trial'); 
        await api.db.updateSettings('installDate', new Date().toISOString());
        // Trial has full features, enable cloud sync by default
        await api.db.updateSettings('cloudSyncEnabled', true);
        await api.db.updateSettings('centerRole', 'duplex');
        await api.db.updateSettings('numberOfCenters', 1);
        setStep(2);
    }
    
    // Handlers for steps 2-6
    const submitStep2 = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.db.update('users', 1, { username: adminData.username, password: adminData.password, email: 'admin@company.local', role: 'Admin', status: 'Active' });
            setStep(3);
        } catch (err: any) {
            setToast({ message: `خطأ في تحديث المدير: ${err.message}`, type: 'error' });
        }
    };
    const submitStep3 = async (e: React.FormEvent) => {
        e.preventDefault();
        await api.db.updateSettings('projectName', companyName);
        setStep(4);
    };
    const submitStep4 = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const r = await api.db.insert('branches', { ...branchData, managerId: null });
            if (r?.id) setCreatedIds(p => ({ ...p, branchId: r.id }));
            setStep(5);
        } catch (error: any) {
            console.error("Setup Wizard Branch Error:", error);
            if (error.message && error.message.includes('UNIQUE constraint failed')) {
                setToast({ message: 'كود الفرع مستخدم مسبقاً. يرجى تغييره.', type: 'error' });
            } else {
                setToast({ message: `حدث خطأ أثناء حفظ الفرع: ${error.message}`, type: 'error' });
            }
        }
    };
    const submitStep5 = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const r = await api.db.insert('departments', { name: deptData.name, branchId: createdIds.branchId, managerId: null });
            if (r?.id) setCreatedIds(p => ({ ...p, departmentId: r.id }));
            setStep(6);
        } catch (error: any) {
            console.error("Setup Wizard Dept Error:", error);
            setToast({ message: `حدث خطأ أثناء حفظ القسم: ${error.message}`, type: 'error' });
        }
    };
    const handleAddJobTitle = () => {
        if (!currentJob.name.trim()) return;
        setJobTitlesList([...jobTitlesList, currentJob]);
        setCurrentJob({ name: '', description: '' });
    };
    const handleRemoveJobTitle = (index: number) => {
        setJobTitlesList(jobTitlesList.filter((_, i) => i !== index));
    };
    
    const submitStep6 = async () => {
        const finalJobs = [...jobTitlesList];
        if (currentJob.name.trim()) {
            finalJobs.push(currentJob);
        }

        if (finalJobs.length === 0) {
            setToast({ message: 'أضف مسمى وظيفي واحد على الأقل.', type: 'error' });
            return;
        }

        try {
            for (const job of finalJobs) {
                // Ensure names are trimmed before saving
                if (job.name.trim()) {
                    await api.db.insert('jobTitles', {
                        name: job.name.trim(),
                        departmentId: createdIds.departmentId,
                        description: job.description.trim()
                    });
                }
            }

            await api.db.updateSettings('setupCompleted', true);
            await onComplete();
        } catch (error: any) {
            console.error("Error during final setup step:", error);
            setToast({ message: `فشل في إكمال الإعداد: ${error.message}`, type: 'error' });
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-90 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[95vh]">
                
                <div className="bg-primary p-6 text-white text-center rounded-t-2xl flex-shrink-0">
                    <h2 className="text-2xl font-bold">تجهيز النظام</h2>
                    <p className="text-white/80 text-sm mt-1">الخطوة {step} من 6</p>
                </div>
                
                <div className="p-8 overflow-y-auto flex-grow">
                    {step === 1 && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="text-center font-bold text-gray-800 mb-4 text-lg">اختر خطة التفعيل المناسبة</h3>
                            
                            {/* License Plan Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* HR Lite */}
                                <div onClick={() => setSelectedPlan('Lite')} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPlan === 'Lite' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-gray-200 hover:shadow-md'}`}>
                                    <h4 className="text-lg font-bold text-center text-primary mb-2">Lite</h4>
                                    <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside"><li>إدارة الموظفين والتوظيف</li><li>سجلات الحضور</li><li>الإعدادات العامة</li></ul>
                                </div>
                                {/* HR Pro */}
                                <div onClick={() => setSelectedPlan('Pro')} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPlan === 'Pro' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-gray-200 hover:shadow-md'}`}>
                                    <h4 className="text-lg font-bold text-center text-primary mb-2">Pro</h4>
                                    <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside"><li>كل ميزات Lite</li><li>نظام الرواتب</li><li>الإجازات والسلف</li><li>التقارير</li></ul>
                                </div>
                                {/* HR Full / Cloud */}
                                <div onClick={() => setSelectedPlan('Full')} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPlan === 'Full' ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-200' : 'border-gray-200 hover:shadow-md'}`}>
                                    <h4 className="text-lg font-bold text-center text-purple-700 mb-2">Full / Cloud</h4>
                                    <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside"><li>كل ميزات Pro</li><li>المزامنة السحابية</li><li>إدارة العملاء والمناديب</li><li>بوابة الرسائل</li></ul>
                                </div>
                            </div>
                            
                            {/* Activation & Cloud Config Section */}
                            {selectedPlan && (
                                <div className="space-y-4 pt-4 border-t animate-fade-in">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">اختر المحافظة</label>
                                        <select value={selectedGovernorate} onChange={(e) => setSelectedGovernorate(e.target.value as Governorate)} className="w-full p-3 border rounded-lg bg-white"><option value="" disabled>-- اختر --</option>{governorates.map(gov => <option key={gov.id} value={gov.id}>{gov.name}</option>)}</select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">أدخل مفتاح التفعيل لنسخة <span className="font-bold">{selectedPlan}</span></label>
                                        <input value={activationCode} onChange={e => setActivationCode(e.target.value)} className="w-full p-3 border rounded-lg ltr text-left uppercase font-mono tracking-widest" placeholder="KEY..." />
                                    </div>
                                    
                                    {/* Cloud Config for Full */}
                                    {selectedPlan === 'Full' && (
                                        <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                                            <label className="flex items-center space-x-3 space-x-reverse cursor-pointer"><input type="checkbox" checked={cloudConfig.enabled} onChange={(e) => setCloudConfig(p => ({...p, enabled: e.target.checked}))} className="h-5 w-5 rounded text-primary focus:ring-primary" /><span className="font-medium text-gray-800">تفعيل المزامنة السحابية</span></label>
                                            {cloudConfig.enabled && (<div className="space-y-3 animate-fade-in">
                                                <div><label className="block text-xs font-medium">دور هذا المركز</label><select value={cloudConfig.role} onChange={e => setCloudConfig(p => ({...p, role: e.target.value as CenterRole}))} className="w-full p-2 border rounded-md text-sm"><option value="duplex">رئيسي (يرسل ويستقبل)</option><option value="fetch-only">فرعي (يستقبل فقط)</option></select></div>
                                                <div><label className="block text-xs font-medium">إجمالي عدد المراكز</label><input type="number" min="1" value={cloudConfig.numberOfCenters} onChange={e => setCloudConfig(p => ({...p, numberOfCenters: Number(e.target.value)}))} className="w-full p-2 border rounded-md text-sm"/></div>
                                            </div>)}
                                        </div>
                                    )}

                                    <div className="flex flex-col items-center gap-3">
                                        <button onClick={handleVerifyAndContinue} disabled={isProcessing} className="w-full bg-primary text-white py-3 rounded-lg hover:bg-primary-dark font-bold disabled:bg-gray-400 text-lg">تفعيل ومتابعة الإعداد</button>
                                        <button onClick={handleStartTrial} className="text-sm text-gray-500 hover:text-gray-700 underline">أو، ابدأ بنسخة تجريبية كاملة (4 أيام)</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Other Steps */}
                    {step === 2 && (<form onSubmit={submitStep2} className="space-y-6 animate-fade-in max-w-md mx-auto"><div className="text-center mb-6"><h3 className="text-xl font-bold">حساب المدير</h3><p className="text-gray-500 text-sm">أنشئ حساب المسؤول الرئيسي</p></div><div><label>اسم المستخدم</label><input value={adminData.username} onChange={e => setAdminData({...adminData, username: e.target.value})} className="w-full p-3 border rounded-lg" required /></div><div><label>كلمة المرور</label><input type="password" value={adminData.password} onChange={e => setAdminData({...adminData, password: e.target.value})} className="w-full p-3 border rounded-lg" required /></div><button type="submit" className="w-full bg-primary text-white py-3 rounded-lg mt-4">التالي</button></form>)}
                    {step === 3 && (<form onSubmit={submitStep3} className="space-y-6 animate-fade-in max-w-md mx-auto"><div className="text-center mb-6"><h3 className="text-xl font-bold">بيانات المؤسسة</h3></div><div><label>اسم الشركة</label><input value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full p-3 border rounded-lg" required /></div><button type="submit" className="w-full bg-primary text-white py-3 rounded-lg mt-4">التالي</button></form>)}
                    {step === 4 && (<form onSubmit={submitStep4} className="space-y-6 animate-fade-in max-w-md mx-auto"><div className="text-center mb-6"><h3 className="text-xl font-bold">إضافة الفرع الرئيسي</h3></div><div><label>اسم الفرع</label><input value={branchData.name} onChange={e => setBranchData({...branchData, name: e.target.value})} className="w-full p-3 border rounded-lg" required /></div><div><label>كود الفرع</label><input value={branchData.branchCode} onChange={e => setBranchData({...branchData, branchCode: e.target.value})} className="w-full p-3 border rounded-lg" required /></div><button type="submit" className="w-full bg-primary text-white py-3 rounded-lg mt-4">التالي</button></form>)}
                    {step === 5 && (<form onSubmit={submitStep5} className="space-y-6 animate-fade-in max-w-md mx-auto"><div className="text-center mb-6"><h3 className="text-xl font-bold">إضافة القسم الأول</h3></div><div><label>اسم القسم</label><input value={deptData.name} onChange={e => setDeptData({name: e.target.value})} className="w-full p-3 border rounded-lg" required /></div><button type="submit" className="w-full bg-primary text-white py-3 rounded-lg mt-4">التالي</button></form>)}
                    {step === 6 && (<div className="space-y-6 animate-fade-in max-w-lg mx-auto"><div className="text-center mb-6"><h3 className="text-xl font-bold">المسميات الوظيفية</h3></div><div className="bg-gray-50 p-4 rounded-lg border space-y-3"><div className="grid grid-cols-2 gap-3"><input value={currentJob.name} onChange={e => setCurrentJob({...currentJob, name: e.target.value})} className="p-2 border rounded-md" placeholder="اسم الوظيفة" /><input value={currentJob.description} onChange={e => setCurrentJob({...currentJob, description: e.target.value})} className="p-2 border rounded-md" placeholder="وصف" /></div><button onClick={handleAddJobTitle} disabled={!currentJob.name} className="w-full bg-white border border-primary text-primary py-2 rounded-md hover:bg-blue-50">+ إضافة</button></div><div className="max-h-40 overflow-y-auto p-2">{jobTitlesList.length > 0 && <ul className="space-y-2">{jobTitlesList.map((job, idx) => (<li key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded"><span>{job.name}</span><button onClick={() => handleRemoveJobTitle(idx)} className="text-red-500">×</button></li>))}</ul>}</div><button onClick={submitStep6} className="w-full bg-green-600 text-white py-3 rounded-lg mt-4">إنهاء وبدء الاستخدام</button></div>)}
                </div>
            </div>
        </div>
    );
};

export default SetupWizard;
