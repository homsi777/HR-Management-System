
import React, { useState } from 'react';
import { IElectronAPI, LicenseType } from '../../types';

interface ActivationSettingsProps {
    isActivated: boolean;
    isTrialExpired: boolean;
    trialDaysRemaining: number | null;
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' }) => void;
    api: IElectronAPI;
    currentLicense: LicenseType;
}

const ActivationSettings: React.FC<ActivationSettingsProps> = ({ isActivated, isTrialExpired, trialDaysRemaining, refreshData, setToast, api, currentLicense }) => {
    const [activationCode, setActivationCode] = useState('');
    const [isChangingLicense, setIsChangingLicense] = useState(false);
    const [targetType, setTargetType] = useState<LicenseType>('Full');
    const [enableCloud, setEnableCloud] = useState(true);

    const handleVerifyCode = async () => {
        if (!activationCode) {
            setToast({ message: 'الرجاء إدخال رمز التفعيل.', type: 'error' });
            return;
        }
        
        // Pass the user-selected target type and cloud preference
        const result = await api.app.verifyActivationCode({ 
            code: activationCode, 
            type: targetType,
            enableCloud: targetType === 'Full' ? enableCloud : false 
        });
        
        setToast({ message: result.message, type: result.success ? 'success' : 'error' });
        if (result.success) {
            setActivationCode('');
            setIsChangingLicense(false);
            await refreshData();
        }
    };

    const getStatusContent = () => {
        if (isActivated) {
            return (
                <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md shadow-sm" role="alert">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="font-bold text-lg mb-1">البرنامج مفعل</p>
                            <p>أنت تستخدم حالياً إصدار: <span className="font-bold bg-white px-2 py-0.5 rounded border border-green-300">{currentLicense}</span></p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>
            );
        }
        if (isTrialExpired) {
            return (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow-sm" role="alert">
                    <p className="font-bold text-lg">انتهت الفترة التجريبية</p>
                    <p>الرجاء إدخال رمز تفعيل صالح للاستمرار في استخدام البرنامج بكامل ميزاته.</p>
                </div>
            );
        }
        return (
            <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded-md shadow-sm" role="alert">
                <p className="font-bold text-lg">فترة تجريبية</p>
                <p>أنت حالياً تستخدم النسخة التجريبية ({currentLicense}). يتبقى لديك {trialDaysRemaining} يومًا.</p>
            </div>
        );
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-neutral mb-6 border-b pb-2">حالة الترخيص والتفعيل</h3>
            
            <div className="space-y-6">
                {getStatusContent()}

                {/* Show Change Button if already activated and not currently changing */}
                {isActivated && !isChangingLicense && (
                    <div className="text-center pt-4">
                        <button 
                            onClick={() => setIsChangingLicense(true)}
                            className="text-primary hover:text-primary-dark font-semibold underline decoration-dotted underline-offset-4 hover:decoration-solid transition-all"
                        >
                            تغيير نوع النسخة / ترقية الإصدار
                        </button>
                    </div>
                )}

                {/* Show Input Form if NOT activated OR if user requested change */}
                {(!isActivated || isChangingLicense) && (
                     <div className="border border-gray-200 rounded-lg p-5 bg-gray-50 mt-4 animate-fade-in">
                        <h4 className="text-lg font-bold text-gray-800 mb-3">
                            {isActivated ? 'تحديث الترخيص' : 'تفعيل جديد'}
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            {/* License Type Selection Cards */}
                            {(['Lite', 'Pro', 'Full'] as LicenseType[]).map((type) => (
                                <div 
                                    key={type}
                                    onClick={() => setTargetType(type)}
                                    className={`cursor-pointer border rounded-lg p-3 text-center transition-all ${
                                        targetType === type 
                                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                                        : 'border-gray-300 hover:bg-gray-100'
                                    }`}
                                >
                                    <div className="font-bold text-gray-800">{type}</div>
                                    <div className="text-xs text-gray-500">
                                        {type === 'Lite' && 'الأساسية'}
                                        {type === 'Pro' && 'المتقدمة'}
                                        {type === 'Full' && 'الشاملة'}
                                    </div>
                                    {targetType === type && (
                                        <div className="mt-1 text-primary text-xs font-bold">✔ محدد</div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Enable Cloud Sync Checkbox - ONLY VISIBLE IF FULL SELECTED */}
                        {targetType === 'Full' && (
                            <div className="mb-4 bg-white border border-gray-200 p-3 rounded-lg flex items-start gap-3 shadow-sm">
                                <div className="flex h-5 items-center">
                                    <input
                                        id="enable_cloud"
                                        name="enable_cloud"
                                        type="checkbox"
                                        checked={enableCloud}
                                        onChange={(e) => setEnableCloud(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                </div>
                                <div className="text-sm">
                                    <label htmlFor="enable_cloud" className="font-medium text-gray-900 cursor-pointer">
                                        تفعيل الخدمة السحابية (المزامنة)
                                    </label>
                                    <p className="text-gray-500">يتيح لك رفع وتنزيل البيانات من السيرفر السحابي لربط الفروع.</p>
                                </div>
                            </div>
                        )}

                        <label className="block text-sm font-medium text-gray-700 mb-1">مفتاح التفعيل للنسخة المختارة</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                placeholder="Example: RIFF123456"
                                value={activationCode}
                                onChange={(e) => setActivationCode(e.target.value)}
                                className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary ltr-input uppercase font-mono tracking-wider"
                                style={{ direction: 'ltr', textAlign: 'left' }}
                            />
                            <button 
                                onClick={handleVerifyCode} 
                                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition font-bold shadow-sm"
                            >
                                {isActivated ? 'تحديث' : 'تفعيل'}
                            </button>
                        </div>
                        {isChangingLicense && (
                            <button 
                                onClick={() => { setIsChangingLicense(false); setActivationCode(''); }}
                                className="text-sm text-gray-500 mt-3 hover:text-gray-700 underline"
                            >
                                إلغاء
                            </button>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                            * سيقوم النظام بالتحقق من صحة المفتاح ومطابقته لنوع النسخة تلقائياً.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivationSettings;
