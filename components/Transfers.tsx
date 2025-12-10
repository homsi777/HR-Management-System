
import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Transfer, IElectronAPI, PersonInfo, TransferStatus, ScannedIDData } from '../types';
import Modal from './ui/Modal';
import { ICONS } from '../constants';

const transferStatusTranslations: Record<TransferStatus, string> = {
    'Pending': 'قيد الانتظار',
    'Delivered': 'تم التسليم',
    'Cancelled': 'ملغاة'
};

const initialPersonInfo: PersonInfo = { firstName: '', lastName: '', fatherName: '', motherName: '', dob: '', nationalId: '' };
const initialFormData: Omit<Transfer, 'id'> = {
    sender: initialPersonInfo,
    receiver: initialPersonInfo,
    amount: 0,
    currency: 'USD',
    date: new Date().toISOString(),
    status: 'Pending',
    notes: ''
};

interface TransfersProps {
    transfers: Transfer[];
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
    api: IElectronAPI;
}

const Transfers: React.FC<TransfersProps> = ({ transfers, refreshData, setToast, api }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Omit<Transfer, 'id'>>(initialFormData);
    const [isScanningFor, setIsScanningFor] = useState<false | 'sender' | 'receiver'>(false);
    const scannerSettingsRef = useRef({ port: '', baudRate: 19200 });

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

    // Effect to manage scanner listener lifecycle
    useEffect(() => {
        if (!isScanningFor || !isModalOpen) return;

        const handleScanData = (data: ScannedIDData) => {
            setToast({ message: 'تم استلام البيانات، جاري المعالجة...', type: 'info' });
            
            // Extract date from birth_info
            const dateMatch = data.birth_info.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/);
            const dob = dateMatch ? dateMatch[0].replace(/\//g, '-') : '';

            setFormData(prev => ({
                ...prev,
                [isScanningFor]: {
                    firstName: data.given_name,
                    lastName: data.family_name,
                    fatherName: data.father_name,
                    motherName: data.mother_name,
                    dob: dob,
                    nationalId: data.national_id
                }
            }));
            setToast({ message: 'تم ملء البيانات بنجاح.', type: 'success' });
            setIsScanningFor(false); // Stop scanning after one successful read
        };
        
        const handleScanError = ({ message }: { message: string }) => {
            setToast({ message, type: 'error' });
            setIsScanningFor(false);
        };
        
        api.scanner.onScanData(handleScanData);
        api.scanner.onScanError(handleScanError);
        api.scanner.startListener(scannerSettingsRef.current);

        return () => {
            api.scanner.stopListener();
            api.scanner.removeListeners();
        };

    }, [isScanningFor, isModalOpen, api.scanner, setToast]);
    
    const handleAdd = () => {
        setFormData(initialFormData);
        setIsModalOpen(true);
    };

    const handleScan = (target: 'sender' | 'receiver') => {
        if (!scannerSettingsRef.current.port) {
            setToast({ message: 'الرجاء تحديد منفذ الماسح الضوئي في الإعدادات أولاً.', type: 'error' });
            return;
        }
        setIsScanningFor(target);
        setToast({ message: `جاري انتظار المسح لـ ${target === 'sender' ? 'المرسل' : 'المستلم'}...`, type: 'info' });
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>, person?: 'sender' | 'receiver') => {
        const { name, value } = e.target;
        if (person) {
            setFormData(prev => ({
                ...prev,
                [person]: { ...prev[person], [name]: value }
            }));
        } else {
            let newVal: string | number = value;
            if (name === 'amount') {
                const floatVal = parseFloat(value);
                newVal = isNaN(floatVal) ? 0 : floatVal;
            }
            setFormData(prev => ({ ...prev, [name]: newVal }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await api.db.insert('transfers', formData);
        await refreshData();
        setIsModalOpen(false);
        setToast({ message: 'تمت إضافة الحوالة بنجاح', type: 'success' });
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-neutral">إدارة الحوالات</h2>
                <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition">إضافة حوالة جديدة</button>
            </div>
            <div className="bg-white rounded-xl shadow-md overflow-x-auto">
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6">المرسل</th>
                            <th className="py-3 px-6">المستلم</th>
                            <th className="py-3 px-6">المبلغ</th>
                            <th className="py-3 px-6">التاريخ</th>
                            <th className="py-3 px-6">الحالة</th>
                            <th className="py-3 px-6">إجراءات</th>
                        </tr>
                    </thead>
                     <tbody className="divide-y divide-gray-200">
                        {transfers.map(t => (
                            <tr key={t.id}>
                                <td className="py-4 px-6">{t.sender.firstName} {t.sender.lastName}</td>
                                <td className="py-4 px-6">{t.receiver.firstName} {t.receiver.lastName}</td>
                                <td className="py-4 px-6">{t.amount} {t.currency}</td>
                                <td className="py-4 px-6">{new Date(t.date).toLocaleString()}</td>
                                <td className="py-4 px-6">{transferStatusTranslations[t.status]}</td>
                                <td className="py-4 px-6 space-x-2 space-x-reverse">
                                    <button className="text-primary hover:text-primary-dark p-1">{React.cloneElement(ICONS.edit, {className: "h-5 w-5"})}</button>
                                    <button className="text-red-600 hover:text-red-800 p-1">{React.cloneElement(ICONS.delete, {className: "h-5 w-5"})}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Modal title="إضافة حوالة جديدة" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="large">
                <form onSubmit={handleSubmit} className="p-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Sender Info */}
                        <div className="border p-4 rounded-lg space-y-3">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-neutral">بيانات المرسل</h3>
                                <button type="button" onClick={() => handleScan('sender')} disabled={!!isScanningFor} className="bg-blue-600 text-white px-3 py-2 text-sm rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:bg-gray-400">
                                    {isScanningFor === 'sender' ? 'جاري المسح...' : <>{React.cloneElement(ICONS.scanner, {className: "h-5 w-5"})} مسح الهوية</>}
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-xs">الاسم الأول</label><input name="firstName" value={formData.sender.firstName} onChange={(e) => handleChange(e, 'sender')} className="w-full p-2 border rounded-md" /></div>
                                <div><label className="text-xs">الكنية</label><input name="lastName" value={formData.sender.lastName} onChange={(e) => handleChange(e, 'sender')} className="w-full p-2 border rounded-md" /></div>
                                <div><label className="text-xs">اسم الأب</label><input name="fatherName" value={formData.sender.fatherName} onChange={(e) => handleChange(e, 'sender')} className="w-full p-2 border rounded-md" /></div>
                                <div><label className="text-xs">اسم الأم</label><input name="motherName" value={formData.sender.motherName} onChange={(e) => handleChange(e, 'sender')} className="w-full p-2 border rounded-md" /></div>
                                <div><label className="text-xs">تاريخ الميلاد</label><input name="dob" value={formData.sender.dob} onChange={(e) => handleChange(e, 'sender')} className="w-full p-2 border rounded-md" /></div>
                                <div><label className="text-xs">الرقم الوطني</label><input name="nationalId" value={formData.sender.nationalId} onChange={(e) => handleChange(e, 'sender')} className="w-full p-2 border rounded-md" /></div>
                            </div>
                        </div>
                        {/* Receiver Info */}
                         <div className="border p-4 rounded-lg space-y-3">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-neutral">بيانات المستلم</h3>
                                <button type="button" onClick={() => handleScan('receiver')} disabled={!!isScanningFor} className="bg-blue-600 text-white px-3 py-2 text-sm rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:bg-gray-400">
                                     {isScanningFor === 'receiver' ? 'جاري المسح...' : <>{React.cloneElement(ICONS.scanner, {className: "h-5 w-5"})} مسح الهوية</>}
                                </button>
                            </div>
                           <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-xs">الاسم الأول</label><input name="firstName" value={formData.receiver.firstName} onChange={(e) => handleChange(e, 'receiver')} className="w-full p-2 border rounded-md" /></div>
                                <div><label className="text-xs">الكنية</label><input name="lastName" value={formData.receiver.lastName} onChange={(e) => handleChange(e, 'receiver')} className="w-full p-2 border rounded-md" /></div>
                                <div><label className="text-xs">اسم الأب</label><input name="fatherName" value={formData.receiver.fatherName} onChange={(e) => handleChange(e, 'receiver')} className="w-full p-2 border rounded-md" /></div>
                                <div><label className="text-xs">اسم الأم</label><input name="motherName" value={formData.receiver.motherName} onChange={(e) => handleChange(e, 'receiver')} className="w-full p-2 border rounded-md" /></div>
                                <div><label className="text-xs">تاريخ الميلاد</label><input name="dob" value={formData.receiver.dob} onChange={(e) => handleChange(e, 'receiver')} className="w-full p-2 border rounded-md" /></div>
                                <div><label className="text-xs">الرقم الوطني</label><input name="nationalId" value={formData.receiver.nationalId} onChange={(e) => handleChange(e, 'receiver')} className="w-full p-2 border rounded-md" /></div>
                            </div>
                        </div>
                    </div>
                    {/* Transfer Details */}
                    <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div><label>المبلغ</label><input name="amount" type="number" step="any" min="0" value={formData.amount || ''} onChange={handleChange} className="w-full p-2 border rounded-md" /></div>
                         <div><label>العملة</label><select name="currency" value={formData.currency} onChange={handleChange} className="w-full p-2 border rounded-md bg-white"><option>USD</option><option>SYP</option><option>TRY</option></select></div>
                         <div className="md:col-span-3"><label>ملاحظات</label><textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full p-2 border rounded-md" rows={2}></textarea></div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">حفظ الحوالة</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Transfers;
