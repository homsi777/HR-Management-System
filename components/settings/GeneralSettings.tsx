import React, { useState, useEffect } from 'react';
import { IElectronAPI, CenterRole } from '../../types';
import Modal from '../ui/Modal';

interface GeneralSettingsProps {
    workdays: number[];
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
    api: IElectronAPI;
    cloudSyncEnabled: boolean;
}

const weekDays = [
    { id: 0, name: 'الأحد' }, { id: 1, name: 'الاثنين' }, { id: 2, name: 'الثلاثاء' },
    { id: 3, name: 'الأربعاء' }, { id: 4, name: 'الخميس' }, { id: 5, name: 'الجمعة' },
    { id: 6, name: 'السبت' },
];

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ workdays, refreshData, setToast, api, cloudSyncEnabled }) => {
    const [selectedDays, setSelectedDays] = useState(new Set(workdays));
    const [isClearModalOpen, setIsClearModalOpen] = useState(false);
    const [clearConfirmationText, setClearConfirmationText] = useState('');
    const [cloudSettings, setCloudSettings] = useState<{
        syncKey: string | null;
        centerRole: CenterRole | null;
        numberOfCenters: number | null;
    }>({ syncKey: null, centerRole: null, numberOfCenters: null });

    useEffect(() => {
        setSelectedDays(new Set(workdays));
        const fetchSettings = async () => {
            if (cloudSyncEnabled) {
                const [key, role, num] = await Promise.all([
                    api.db.getSettings('syncKey'),
                    api.db.getSettings('centerRole'),
                    api.db.getSettings('numberOfCenters')
                ]);
                setCloudSettings({
                    syncKey: key?.value ? JSON.parse(key.value) : null,
                    centerRole: role?.value ? JSON.parse(role.value) : null,
                    numberOfCenters: num?.value ? JSON.parse(num.value) : null
                });
            }
        };
        fetchSettings();
    }, [workdays, api.db, cloudSyncEnabled]);

    const handleDayChange = (dayId: number) => {
        const newSelectedDays = new Set(selectedDays);
        if (newSelectedDays.has(dayId)) {
            newSelectedDays.delete(dayId);
        } else {
            newSelectedDays.add(dayId);
        }
        setSelectedDays(newSelectedDays);
    };

    const handleSave = async () => {
        await api.db.updateSettings('workdays', Array.from(selectedDays).sort());
        await refreshData();
        setToast({ message: 'تم حفظ إعدادات أيام الدوام بنجاح.', type: 'success' });
    };

    const handleConfirmClear = async () => {
        if (clearConfirmationText !== 'مسح') {
            setToast({ message: 'النص التأكيدي غير صحيح.', type: 'error' });
            return;
        }
        
        setToast({ message: 'جاري مسح البيانات...', type: 'info' });
        const result = await api.db.clearAllData(clearConfirmationText);
        await api.db.updateSettings('setupCompleted', false);
        
        setToast({ message: result.message, type: result.success ? 'success' : 'error' });

        if (result.success) {
            setIsClearModalOpen(false);
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        }
    };
    
    const handleExportDatabase = async () => {
        setToast({ message: 'جاري تحضير التصدير...', type: 'info' });
        const result = await api.db.export();
        setToast({ message: result.message, type: result.success ? 'success' : 'error' });
    };

    const handleImportDatabase = async () => {
        if (!api.app.showOpenDialog) {
            setToast({ message: 'هذه الميزة غير مدعومة في بيئة الويب.', type: 'info' });
            return;
        }

        const { canceled, filePath } = await api.app.showOpenDialog();
        if (canceled || !filePath) return;

        const userConfirmed = window.confirm(
            'تحذير: سيؤدي استيراد قاعدة بيانات جديدة إلى استبدال جميع البيانات الحالية بشكل دائم. هل تريد المتابعة؟'
        );

        if (userConfirmed) {
            setToast({ message: 'جاري استيراد قاعدة البيانات...', type: 'info' });
            const result = await api.db.import(filePath);
            if (!result.success) {
                 setToast({ message: result.message, type: 'error' });
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-xl font-bold text-neutral mb-4">إعدادات المزامنة السحابية</h3>
                {cloudSyncEnabled ? (
                    <div className="space-y-3">
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <label className="block text-sm font-medium text-green-800">حالة المزامنة</label>
                            <p className="text-green-900 font-semibold">مفعلة</p>
                        </div>
                         <div className="p-3 bg-gray-50 border rounded-lg">
                            <label className="block text-sm font-medium text-gray-700">مفتاح المزامنة (تلقائي)</label>
                            <p className="font-mono text-center text-sm bg-gray-200 p-1 rounded mt-1">{cloudSettings.syncKey || '...'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-gray-50 border rounded-lg">
                                <label className="block text-sm font-medium text-gray-700">دور المركز</label>
                                <p className="font-semibold">{cloudSettings.centerRole === 'duplex' ? 'رئيسي (يرسل ويستقبل)' : 'فرعي (يستقبل فقط)'}</p>
                            </div>
                            <div className="p-3 bg-gray-50 border rounded-lg">
                                <label className="block text-sm font-medium text-gray-700">عدد المراكز</label>
                                <p className="font-semibold">{cloudSettings.numberOfCenters || 'غير محدد'}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-center">
                        <p>المزامنة السحابية غير مفعلة لهذا المركز.</p>
                        <p className="text-xs">تم اختيار "بدون خدمة سحابية" أثناء الإعداد الأولي.</p>
                    </div>
                )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md">
                 <h3 className="text-xl font-bold text-neutral mb-4">إعدادات الدوام</h3>
                 <div className="border-t pt-4">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">أيام الدوام الرسمية</h4>
                    <p className="text-sm text-gray-500 mb-4">
                        حدد أيام العمل في الأسبوع. سيتم استخدام هذا الإعداد لحساب الغياب والرواتب والتقارير.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        {weekDays.map(day => (
                            <label key={day.id} className="flex items-center space-x-2 space-x-reverse p-3 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50">
                                <input
                                    type="checkbox"
                                    checked={selectedDays.has(day.id)}
                                    onChange={() => handleDayChange(day.id)}
                                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <span className="font-medium text-gray-700">{day.name}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors duration-200"
                    >
                        حفظ إعدادات الدوام
                    </button>
                </div>
            </div>
            
             <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-xl font-bold text-neutral mb-4">إدارة البيانات</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Export Section */}
                    <div className="flex items-center justify-between border p-4 rounded-lg">
                        <div>
                            <h4 className="font-semibold">تصدير نسخة احتياطية</h4>
                            <p className="text-sm text-gray-600">
                               قم بتصدير نسخة كاملة من قاعدة البيانات (.db) للاحتفاظ بها كنسخة احتياطية.
                            </p>
                        </div>
                        <button
                            onClick={handleExportDatabase}
                            className="bg-green-600 text-white font-bold px-5 py-2 rounded-lg hover:bg-green-700 transition flex-shrink-0"
                        >
                            تصدير الآن
                        </button>
                    </div>
                    {/* Import Section */}
                    <div className="flex items-center justify-between border p-4 rounded-lg">
                        <div>
                            <h4 className="font-semibold">استيراد نسخة احتياطية</h4>
                            <p className="text-sm text-gray-600">
                               استبدل البيانات الحالية بملف نسخة احتياطية. سيقوم النظام بترقية الجداول تلقائيًا.
                            </p>
                        </div>
                        <button
                            onClick={handleImportDatabase}
                            className="bg-indigo-600 text-white font-bold px-5 py-2 rounded-lg hover:bg-indigo-700 transition flex-shrink-0"
                        >
                            استيراد الآن
                        </button>
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-red-500">
                <h3 className="text-xl font-bold text-red-700 mb-4">منطقة الخطر</h3>
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-semibold">مسح جميع البيانات</h4>
                        <p className="text-sm text-gray-600 max-w-2xl">
                            هذا الإجراء سيقوم بحذف جميع البيانات في النظام بشكل نهائي، بما في ذلك الموظفين، الحضور، الإعدادات، وكل شيء آخر. لا يمكن التراجع عن هذا الإجراء.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsClearModalOpen(true)}
                        className="bg-red-600 text-white font-bold px-5 py-2 rounded-lg hover:bg-red-700 transition"
                    >
                        مسح البيانات
                    </button>
                </div>
            </div>

            <Modal
                title="تأكيد مسح قاعدة البيانات"
                isOpen={isClearModalOpen}
                onClose={() => setIsClearModalOpen(false)}
            >
                <div className="p-2 space-y-4">
                    <p className="text-lg font-semibold text-red-600">تحذير! أنت على وشك حذف جميع البيانات نهائياً.</p>
                    <p className="text-gray-700">
                        هذا الإجراء لا يمكن التراجع عنه. سيؤدي إلى مسح كل الموظفين، سجلات الحضور، الإجازات، الرواتب، الإعدادات، وجميع المعلومات الأخرى المخزنة في النظام.
                        <br/><span className="text-xs text-gray-500">(سيؤدي هذا أيضاً إلى إعادة تعيين حالة المعالج الأولي)</span>
                    </p>
                    <p className="text-gray-700">
                        للتأكيد، يرجى كتابة كلمة "<strong className="font-mono">مسح</strong>" في الحقل أدناه.
                    </p>
                    <div>
                        <input
                            type="text"
                            value={clearConfirmationText}
                            onChange={(e) => setClearConfirmationText(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 text-center"
                            placeholder="اكتب هنا للتأكيد"
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => setIsClearModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
                            إلغاء
                        </button>
                        <button
                            onClick={handleConfirmClear}
                            disabled={clearConfirmationText !== 'مسح'}
                            className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition disabled:bg-red-300 disabled:cursor-not-allowed"
                        >
                            أنا أفهم العواقب، قم بالمسح
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default GeneralSettings;