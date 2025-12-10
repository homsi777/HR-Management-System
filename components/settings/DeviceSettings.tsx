




import React, { useState } from 'react';
import { Device, SyncSchedule, IElectronAPI } from '../../types';
import Modal from '../ui/Modal';
import { ICONS } from '../../constants';

interface DeviceSettingsProps {
    devices: Device[];
    syncSchedule: SyncSchedule;
    nextSyncTime: string | null;
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
    api: IElectronAPI;
}

const initialFormData: Omit<Device, 'id' | 'status'> = { name: '', ip: '', port: 4370, commKey: 0, brand: 'ZKTeco' };

const DeviceSettings: React.FC<DeviceSettingsProps> = ({ devices, syncSchedule, nextSyncTime, refreshData, setToast, api }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [formData, setFormData] = useState<Omit<Device, 'id' | 'status'>>(initialFormData);
    const [schedule, setSchedule] = useState<SyncSchedule>(syncSchedule);
    const [isSyncingPython, setIsSyncingPython] = useState(false);
    const [isSyncingNode, setIsSyncingNode] = useState(false);
    
    // State for python sync selection
    const [pythonSyncDeviceId, setPythonSyncDeviceId] = useState<number | ''>('');


    const handleAdd = () => {
        setSelectedDevice(null);
        setFormData(initialFormData);
        setIsModalOpen(true);
    };

    const handleEdit = (device: Device) => {
        setSelectedDevice(device);
        setFormData(device);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذا الجهاز؟')) {
            await api.db.delete('devices', id);
            await refreshData();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedDevice) {
            await api.db.update('devices', selectedDevice.id, formData);
            setToast({ message: 'تم تحديث الجهاز بنجاح.', type: 'success' });
            await refreshData();
            setIsModalOpen(false);
        } else {
            await api.db.insert('devices', { ...formData, status: 'unknown' });
            setToast({ message: 'تمت إضافة الجهاز بنجاح.', type: 'success' });
            await refreshData();
            setFormData(initialFormData); // Reset form for next entry
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: ['port', 'commKey'].includes(name) ? Number(value) : value }));
    };

    const handleTestConnection = async (device: Device) => {
        setToast({ message: `جاري اختبار الاتصال بـ ${device.name}...`, type: 'info' });
        const result = await api.device.testConnection(device);
        setToast({ message: result.message, type: result.success ? 'success' : 'info' });
        await refreshData();
    };

    const handleSync = async (device: Device) => {
        // This calls the mock sync
        const result = await api.device.syncAttendance(device);
        setToast({ message: result.message, type: 'info' });
    };

    const handleNodeSync = async (device: Device) => {
        setIsSyncingNode(true);
        setToast({ message: `جاري الاتصال المباشر بـ ${device.name} (Node.js)...`, type: 'info' });
        try {
            const result = await api.device.syncAttendanceNode(device);
            setToast({ message: result.message, type: result.success ? 'success' : 'error' });
            if (result.success) {
                await refreshData();
            }
        } catch (error) {
            console.error("Node Sync Error:", error);
            setToast({ message: 'فشل الاتصال بالجهاز.', type: 'error' });
        } finally {
            setIsSyncingNode(false);
        }
    };

    const handleScheduleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setSchedule(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSaveSchedule = async () => {
        await api.db.updateSettings('syncSchedule', schedule);
        setToast({ message: 'تم حفظ إعدادات المزامنة.', type: 'success' });
        await refreshData();
    };

    const handlePythonSync = async () => {
        if (!pythonSyncDeviceId) {
            setToast({ message: 'الرجاء اختيار جهاز.', type: 'error' });
            return;
        }
        const device = devices.find(d => d.id === Number(pythonSyncDeviceId));
        if (!device) return;

        setIsSyncingPython(true);
        setToast({ message: `جاري تشغيل سكربت بايثون للجهاز ${device.name}...`, type: 'info' });
        try {
            const result = await api.device.runPythonScript(device);
            setToast({ message: result.message, type: result.success ? 'success' : 'error' });
            if (result.success) {
                await refreshData();
            }
        } catch (error) {
            console.error("Sync error:", error);
            setToast({ message: 'حدث خطأ أثناء محاولة تشغيل السكربت.', type: 'error' });
        } finally {
            setIsSyncingPython(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-neutral">إدارة أجهزة البصمة</h3>
                    <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition">إضافة جهاز جديد</button>
                </div>
                <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-800 p-3 rounded-md mb-6 text-sm">
                    <strong>ملاحظة:</strong> هذا النظام يدعم استقبال البيانات تلقائياً (Push)، والسحب اليدوي عبر السكربت (Python)، أو السحب المباشر (Node.js).
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-right">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="py-3 px-6">اسم الجهاز</th>
                                <th className="py-3 px-6">بيانات الاتصال</th>
                                <th className="py-3 px-6">الحالة</th>
                                <th className="py-3 px-6">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {devices.map(device => (
                                <tr key={device.id}>
                                    <td className="py-4 px-6">{device.name}</td>
                                    <td className="py-4 px-6 ltr">{device.ip}:{device.port} (Key: {device.commKey || 0})</td>
                                    <td className="py-4 px-6">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${device.status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {device.status === 'connected' ? 'متصل' : 'غير متصل'}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 space-x-2 space-x-reverse whitespace-nowrap">
                                        <button 
                                            onClick={() => handleNodeSync(device)} 
                                            disabled={isSyncingNode}
                                            className="text-green-600 hover:text-green-800 p-1 font-bold flex items-center gap-1 disabled:opacity-50" 
                                            title="سحب مباشر (Node.js)"
                                        >
                                            {isSyncingNode ? <span className="animate-spin h-3 w-3 border-2 border-current rounded-full border-t-transparent"></span> : React.cloneElement(ICONS.sync, { className: "h-5 w-5" })}
                                            مزامنة
                                        </button>
                                        <button onClick={() => handleTestConnection(device)} className="text-blue-600 hover:text-blue-800 p-1 font-semibold" title="اختبار الاتصال">اختبار</button>
                                        <button onClick={() => handleEdit(device)} className="text-primary hover:text-primary-dark p-1">{React.cloneElement(ICONS.edit, { className: "h-5 w-5" })}</button>
                                        <button onClick={() => handleDelete(device.id)} className="text-red-600 hover:text-red-800 p-1">{React.cloneElement(ICONS.delete, { className: "h-5 w-5" })}</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-xl font-bold text-neutral mb-4">المزامنة عبر السكربت (Python)</h3>
                    <p className="text-sm text-gray-600 mb-4">
                        خيار بديل: تشغيل سكربت بايثون الخارجي لسحب البيانات. مفيد للأجهزة التي لا تستجيب للمكتبة الافتراضية.
                    </p>
                    
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">اختر الجهاز</label>
                        <select 
                            value={pythonSyncDeviceId} 
                            onChange={(e) => setPythonSyncDeviceId(Number(e.target.value))} 
                            className="w-full p-2 border rounded-lg bg-white"
                        >
                            <option value="" disabled>-- اختر جهاز --</option>
                            {devices.map(dev => <option key={dev.id} value={dev.id}>{dev.name} ({dev.ip})</option>)}
                        </select>
                    </div>

                    <button 
                        onClick={handlePythonSync} 
                        disabled={isSyncingPython || !pythonSyncDeviceId}
                        className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:bg-gray-400"
                    >
                        {isSyncingPython ? (
                            <>
                                <span className="animate-spin h-5 w-5 border-t-2 border-b-2 border-white rounded-full"></span>
                                جاري السحب...
                            </>
                        ) : (
                            <>
                                {React.cloneElement(ICONS.sync, { className: "h-5 w-5" })}
                                تشغيل سكربت السحب
                            </>
                        )}
                    </button>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md opacity-50 cursor-not-allowed">
                    <h3 className="text-xl font-bold text-neutral mb-4">المزامنة المجدولة</h3>
                    <div className="space-y-4">
                        <label className="flex items-center space-x-2 space-x-reverse">
                            <input type="checkbox" name="enabled" checked={schedule.enabled} onChange={handleScheduleChange} className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary" disabled />
                            <span className="font-medium text-gray-700">تفعيل المزامنة التلقائية</span>
                        </label>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">وقت المزامنة</label>
                            <input type="time" name="time" value={schedule.time} onChange={handleScheduleChange} disabled className="w-full p-2 border rounded bg-white disabled:bg-gray-100" />
                        </div>
                        {nextSyncTime && schedule.enabled && <p className="text-sm text-gray-500">المزامنة التالية مجدولة في: {nextSyncTime}</p>}
                        <button onClick={handleSaveSchedule} className="w-full bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition" disabled>حفظ الإعدادات</button>
                    </div>
                </div>
            </div>

            <Modal title={selectedDevice ? 'تعديل جهاز' : 'إضافة جهاز جديد'} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label>اسم الجهاز</label><input name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded" required /></div>
                    <div><label>IP Address</label><input name="ip" value={formData.ip} onChange={handleChange} className="w-full p-2 border rounded ltr" required /></div>
                    <div className="grid grid-cols-2 gap-4">
                       <div><label>Port</label><input name="port" type="number" value={formData.port} onChange={handleChange} className="w-full p-2 border rounded ltr" required /></div>
                       <div><label>Comm Key</label><input name="commKey" type="number" value={formData.commKey || 0} onChange={handleChange} className="w-full p-2 border rounded ltr" placeholder="0" /></div>
                    </div>
                    <div><label>الشركة المصنعة</label><select name="brand" value={formData.brand} onChange={handleChange} className="w-full p-2 border rounded bg-white" required>
                        <option value="ZKTeco">ZKTeco</option>
                        <option value="Other">Other</option>
                    </select></div>
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">{selectedDevice ? 'حفظ' : 'إضافة'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default DeviceSettings;
