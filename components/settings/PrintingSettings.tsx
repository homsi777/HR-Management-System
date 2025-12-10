import React, { useState, useEffect, useRef } from 'react';
import { IElectronAPI, PrintSettings } from '../../types';

interface PrintingSettingsProps {
    printSettings: PrintSettings | null;
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' }) => void;
    api: IElectronAPI;
}

const defaultSettings: PrintSettings = {
    template: 'template1',
    companyName: 'اسم الشركة',
    address: 'العنوان',
    phone: 'رقم الهاتف',
    receiptTitle: 'إيصال',
    companyLogo: ''
};

const PrintingSettings: React.FC<PrintingSettingsProps> = ({ printSettings, refreshData, setToast, api }) => {
    const [settings, setSettings] = useState<PrintSettings>(printSettings || defaultSettings);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (printSettings) {
            setSettings(printSettings);
        }
    }, [printSettings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setToast({ message: 'الرجاء اختيار ملف صورة صالح.', type: 'error' });
                return;
            }
            if (file.size > 1 * 1024 * 1024) { // 1MB limit for logo
                setToast({ message: 'حجم الصورة كبير جداً. الحد الأقصى 1 ميجابايت.', type: 'error' });
                return;
            }
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                const dataUrl = loadEvent.target?.result as string;
                if (dataUrl) {
                    setSettings(prev => ({ ...prev, companyLogo: dataUrl }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveLogo = () => {
        setSettings(prev => ({ ...prev, companyLogo: '' }));
    };


    const handleSave = async () => {
        await api.db.updateSettings('printSettings', settings);
        await refreshData();
        setToast({ message: 'تم حفظ إعدادات الطباعة بنجاح.', type: 'success' });
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md max-w-4xl mx-auto">
            <h3 className="text-xl font-bold text-neutral mb-4">تخصيص طباعة الإيصالات</h3>
            <div className="space-y-6">
                
                <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">اختر نموذج الترويسة</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {['template1', 'template2', 'template3'].map((templateId, index) => (
                            <label key={templateId} className="relative block cursor-pointer">
                                <input
                                    type="radio"
                                    name="template"
                                    value={templateId}
                                    checked={settings.template === templateId}
                                    onChange={handleChange}
                                    className="sr-only"
                                />
                                <div className={`p-4 border-2 rounded-lg ${settings.template === templateId ? 'border-primary' : 'border-gray-300'}`}>
                                    <p className="font-semibold mb-2">نموذج {index + 1}</p>
                                    <div className="h-20 bg-gray-50 p-2 rounded text-xs text-gray-500 overflow-hidden">
                                        {templateId === 'template1' && <div className="text-center"><div><strong className="block">اسم الشركة</strong><span className="block">العنوان</span><span>الهاتف</span></div></div>}
                                        {templateId === 'template2' && <div className="text-left"><div><strong className="block">اسم الشركة</strong><span className="block">العنوان</span><span>الهاتف</span></div></div>}
                                        {templateId === 'template3' && <div className="text-right"><div><strong className="block">اسم الشركة</strong><span className="block">العنوان</span><span>الهاتف</span></div></div>}
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                        <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">اسم الشركة</label>
                        <input type="text" name="companyName" id="companyName" value={settings.companyName} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                        <label htmlFor="receiptTitle" className="block text-sm font-medium text-gray-700 mb-1">العنوان الافتراضي للإيصال</label>
                        <input type="text" name="receiptTitle" id="receiptTitle" value={settings.receiptTitle} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                        <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                        <input type="text" name="address" id="address" value={settings.address} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
                        <input type="text" name="phone" id="phone" value={settings.phone} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>
                </div>
                
                <div className="border-t pt-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">شعار الشركة</h4>
                    <div className="flex items-center gap-6">
                        <div className="w-24 h-24 bg-gray-100 border rounded-md flex items-center justify-center">
                            {settings.companyLogo ? (
                                <img src={settings.companyLogo} alt="Company Logo" className="max-w-full max-h-full object-contain" />
                            ) : (
                                <span className="text-xs text-gray-400">لا يوجد شعار</span>
                            )}
                        </div>
                        <div className="flex-1 space-y-2">
                             <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleImageUpload} 
                                className="hidden" 
                                accept="image/png, image/jpeg, image/gif" 
                            />
                            <button 
                                type="button" 
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                            >
                                استيراد شعار
                            </button>
                            {settings.companyLogo && (
                                <button 
                                    type="button" 
                                    onClick={handleRemoveLogo}
                                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition mr-2"
                                >
                                    إزالة الشعار
                                </button>
                            )}
                            <p className="text-xs text-gray-500">
                                يفضل استخدام صورة PNG بخلفية شفافة. الحد الأقصى للحجم 1MB.
                            </p>
                        </div>
                    </div>
                </div>


                <div className="flex justify-end pt-4 border-t mt-6">
                    <button onClick={handleSave} className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors">
                        حفظ الإعدادات
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrintingSettings;