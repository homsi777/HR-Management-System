import React, { useState, useEffect } from 'react';
import { IElectronAPI } from '../../types';

interface SmsTemplateSettingsProps {
    setToast: (toast: { message: string, type: 'success' | 'error' }) => void;
    api: IElectronAPI;
}

const SmsTemplateSettings: React.FC<SmsTemplateSettingsProps> = ({ setToast, api }) => {
    const [settings, setSettings] = useState({
        enableLateAttendanceSms: true,
        lateAttendanceSmsTemplate: '',
        enableSalarySms: false,
        salarySmsTemplate: '',
        enableLeaveStatusSms: false,
        leaveApprovedSmsTemplate: '',
        leaveRejectedSmsTemplate: '',
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const settingKeys = Object.keys(settings);
                const fetchedSettings = await Promise.all(
                    settingKeys.map(key => api.db.getSettings(key))
                );

                const newSettings: any = {};
                fetchedSettings.forEach((setting, index) => {
                    const key = settingKeys[index];
                    if (setting && setting.value) {
                        try {
                            newSettings[key] = JSON.parse(setting.value);
                        } catch (e) {
                            console.error(`Failed to parse setting ${key}`, e);
                        }
                    }
                });
                setSettings(prev => ({ ...prev, ...newSettings }));

            } catch (e) {
                console.error("Failed to fetch SMS template settings", e);
                setToast({ message: 'فشل في تحميل إعدادات القوالب.', type: 'error' });
            }
        };
        fetchSettings();
    }, [api.db, setToast]);

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setSettings(prev => ({ ...prev, [name]: checked }));
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        try {
            for (const [key, value] of Object.entries(settings)) {
                await api.db.updateSettings(key, value);
            }
            setToast({ message: 'تم حفظ قوالب الرسائل بنجاح.', type: 'success' });
        } catch (error) {
            console.error("Failed to save SMS templates:", error);
            setToast({ message: 'فشل حفظ الإعدادات.', type: 'error' });
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md max-w-4xl mx-auto">
            <h3 className="text-xl font-bold text-neutral mb-4">إدارة قوالب الرسائل التلقائية</h3>
            <p className="text-sm text-gray-500 mb-6">
                قم بتفعيل وتخصيص الرسائل النصية التي يتم إرسالها تلقائياً عند وقوع أحداث معينة في النظام.
            </p>

            <div className="space-y-8">
                {/* Late Attendance Template */}
                <fieldset className="border rounded-md p-4">
                    <legend className="px-2 text-lg font-semibold text-gray-800">تنبيه التأخير</legend>
                    <div className="space-y-3">
                        <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                            <input
                                type="checkbox"
                                name="enableLateAttendanceSms"
                                checked={settings.enableLateAttendanceSms}
                                onChange={handleCheckboxChange}
                                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="font-medium text-gray-700">تفعيل إرسال رسالة عند تسجيل حضور متأخر</span>
                        </label>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">نص الرسالة</label>
                            <textarea
                                name="lateAttendanceSmsTemplate"
                                value={settings.lateAttendanceSmsTemplate}
                                onChange={handleTextChange}
                                rows={3}
                                className="w-full p-2 border rounded-md font-mono text-sm"
                                disabled={!settings.enableLateAttendanceSms}
                            ></textarea>
                            <p className="text-xs text-gray-500 mt-1">
                                متغيرات متاحة: <code>{'{employeeName}'}</code> <code>{'{time}'}</code>
                            </p>
                        </div>
                    </div>
                </fieldset>

                {/* Salary Notification Template */}
                <fieldset className="border rounded-md p-4">
                    <legend className="px-2 text-lg font-semibold text-gray-800">إشعار تسليم الراتب</legend>
                    <div className="space-y-3">
                        <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                            <input
                                type="checkbox"
                                name="enableSalarySms"
                                checked={settings.enableSalarySms}
                                onChange={handleCheckboxChange}
                                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="font-medium text-gray-700">تفعيل إرسال رسالة عند تسليم الراتب</span>
                        </label>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">نص الرسالة</label>
                            <textarea
                                name="salarySmsTemplate"
                                value={settings.salarySmsTemplate}
                                onChange={handleTextChange}
                                rows={3}
                                className="w-full p-2 border rounded-md font-mono text-sm"
                                disabled={!settings.enableSalarySms}
                            ></textarea>
                            <p className="text-xs text-gray-500 mt-1">
                                متغيرات متاحة: <code>{'{employeeName}'}</code> <code>{'{month}'}</code> <code>{'{year}'}</code> <code>{'{netAmount}'}</code> <code>{'{currency}'}</code>
                            </p>
                        </div>
                    </div>
                </fieldset>

                {/* Leave Status Templates */}
                <fieldset className="border rounded-md p-4">
                    <legend className="px-2 text-lg font-semibold text-gray-800">إشعار حالة الإجازة</legend>
                    <div className="space-y-4">
                        <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                            <input
                                type="checkbox"
                                name="enableLeaveStatusSms"
                                checked={settings.enableLeaveStatusSms}
                                onChange={handleCheckboxChange}
                                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="font-medium text-gray-700">تفعيل إرسال رسالة عند تغيير حالة طلب الإجازة (قبول/رفض)</span>
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">رسالة الموافقة</label>
                                <textarea
                                    name="leaveApprovedSmsTemplate"
                                    value={settings.leaveApprovedSmsTemplate}
                                    onChange={handleTextChange}
                                    rows={4}
                                    className="w-full p-2 border rounded-md font-mono text-sm"
                                    disabled={!settings.enableLeaveStatusSms}
                                ></textarea>
                                <p className="text-xs text-gray-500 mt-1">
                                    متغيرات: <code>{'{employeeName}'}</code> <code>{'{startDate}'}</code> <code>{'{endDate}'}</code>
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">رسالة الرفض</label>
                                <textarea
                                    name="leaveRejectedSmsTemplate"
                                    value={settings.leaveRejectedSmsTemplate}
                                    onChange={handleTextChange}
                                    rows={4}
                                    className="w-full p-2 border rounded-md font-mono text-sm"
                                    disabled={!settings.enableLeaveStatusSms}
                                ></textarea>
                                <p className="text-xs text-gray-500 mt-1">
                                    متغيرات: <code>{'{employeeName}'}</code> <code>{'{startDate}'}</code> <code>{'{endDate}'}</code> <code>{'{reason}'}</code>
                                </p>
                            </div>
                        </div>
                    </div>
                </fieldset>
            </div>

            <div className="flex justify-end pt-6 border-t mt-8">
                <button onClick={handleSave} className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors">
                    حفظ كل القوالب
                </button>
            </div>
        </div>
    );
};

export default SmsTemplateSettings;