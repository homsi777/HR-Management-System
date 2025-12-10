import React, { useState, useMemo } from 'react';
import { SMSMessage, IElectronAPI, Employee, PhoneBookContact, SMSStatus, SMSPriority } from '../types';
import Modal from './ui/Modal';
import { ICONS } from '../constants';

// Props
interface SmsGatewayProps {
    smsLog: SMSMessage[];
    employees: Employee[];
    contacts: PhoneBookContact[];
    api: IElectronAPI;
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
}

// Translations and Styles
const statusTranslations: Record<SMSStatus, string> = {
    'PENDING': 'قيد الانتظار',
    'SENT': 'تم الإرسال',
    'FAILED': 'فشل',
    'RETRYING': 'إعادة محاولة'
};
const statusColors: Record<SMSStatus, string> = {
    'PENDING': 'bg-yellow-100 text-yellow-800',
    'SENT': 'bg-green-100 text-green-800',
    'FAILED': 'bg-red-100 text-red-800',
    'RETRYING': 'bg-blue-100 text-blue-800'
};
const priorityTranslations: Record<SMSPriority, string> = {
    'HIGH': 'عالية',
    'MEDIUM': 'متوسطة',
    'LOW': 'منخفضة'
};

// Main Component
const SmsGateway: React.FC<SmsGatewayProps> = ({ smsLog, employees, contacts, api, refreshData, setToast }) => {
    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | SMSStatus>('all');
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    
    // Memos
    const filteredLog = useMemo(() => {
        return smsLog.filter(msg => 
            (filterStatus === 'all' || msg.status === filterStatus) &&
            (searchTerm === '' || 
             msg.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
             msg.recipientPhone.includes(searchTerm) ||
             msg.text.toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }, [smsLog, searchTerm, filterStatus]);

    // Send Modal Logic
    const handleOpenSendModal = () => setIsSendModalOpen(true);
    const handleCloseSendModal = () => setIsSendModalOpen(false);
    
    // JSX
    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-neutral">بوابة الرسائل النصية (SMS)</h2>
                <div className="flex items-center gap-2">
                    <button onClick={handleOpenSendModal} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition flex items-center gap-2">
                         {React.cloneElement(ICONS.send, {className: "h-5 w-5"})} إرسال رسالة جديدة
                    </button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-md mb-6 flex items-center gap-4">
                <input
                    type="text"
                    placeholder="بحث بالاسم، الرقم أو محتوى الرسالة..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="p-2 border rounded-lg bg-white w-1/3"
                />
                 <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value as any)}
                    className="p-2 border rounded-lg bg-white"
                >
                    <option value="all">كل الحالات</option>
                    {Object.entries(statusTranslations).map(([key, value]) => (
                        <option key={key} value={key}>{value}</option>
                    ))}
                </select>
            </div>
            
            <div className="bg-white rounded-xl shadow-md overflow-x-auto">
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6 font-medium">المستلم</th>
                            <th className="py-3 px-6 font-medium">رقم الهاتف</th>
                            <th className="py-3 px-6 font-medium">محتوى الرسالة</th>
                            <th className="py-3 px-6 font-medium">الحالة</th>
                            <th className="py-3 px-6 font-medium">الأولوية</th>
                            <th className="py-3 px-6 font-medium">تاريخ الإنشاء</th>
                            <th className="py-3 px-6 font-medium">المحاولات</th>
                            <th className="py-3 px-6">آخر خطأ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredLog.map(msg => (
                            <tr key={msg.id}>
                                <td className="py-4 px-6 font-semibold">{msg.recipientName}</td>
                                <td className="py-4 px-6">{msg.recipientPhone}</td>
                                <td className="py-4 px-6 text-sm text-gray-700 max-w-sm truncate" title={msg.text}>{msg.text}</td>
                                <td className="py-4 px-6">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[msg.status]}`}>
                                        {statusTranslations[msg.status]}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-sm">{priorityTranslations[msg.priority]}</td>
                                <td className="py-4 px-6 text-sm">{new Date(msg.createdAt).toLocaleString()}</td>
                                <td className="py-4 px-6 text-sm">{msg.attempts}</td>
                                <td className="py-4 px-6 text-xs text-red-600 max-w-xs truncate" title={msg.lastError}>{msg.lastError}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredLog.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        <p>لا توجد رسائل لعرضها.</p>
                    </div>
                )}
            </div>

            {/* Send SMS Modal */}
            <SendSmsModal 
                isOpen={isSendModalOpen} 
                onClose={handleCloseSendModal}
                api={api}
                setToast={setToast}
                employees={employees}
                contacts={contacts}
            />
        </div>
    );
};

// Reusable Send SMS Modal Component
interface SendSmsModalProps {
    isOpen: boolean;
    onClose: () => void;
    api: IElectronAPI;
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
    employees: Employee[];
    contacts: PhoneBookContact[];
    initialTarget?: { name: string, phone: string };
}

const SendSmsModal: React.FC<SendSmsModalProps> = ({ isOpen, onClose, api, setToast, employees, contacts, initialTarget }) => {
    const [recipientName, setRecipientName] = useState('');
    const [recipientPhone, setRecipientPhone] = useState('');
    const [text, setText] = useState('');
    const [priority, setPriority] = useState<SMSPriority>('MEDIUM');

    React.useEffect(() => {
        if (isOpen) {
            setRecipientName(initialTarget?.name || '');
            setRecipientPhone(initialTarget?.phone || '');
            setText('');
            setPriority('MEDIUM');
        }
    }, [isOpen, initialTarget]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipientPhone.trim() || !text.trim()) {
            setToast({ message: 'الرجاء إدخال رقم الهاتف ونص الرسالة.', type: 'error' });
            return;
        }

        const result = await api.sms.send({
            recipientName: recipientName.trim() || recipientPhone.trim(),
            recipientPhone: recipientPhone.trim(),
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
        <Modal title="إرسال رسالة نصية جديدة" isOpen={isOpen} onClose={onClose}>
            <form onSubmit={handleSubmit} className="p-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستلم (اختياري)</label>
                        <input value={recipientName} onChange={e => setRecipientName(e.target.value)} className="w-full p-2 border rounded-md" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
                        <input value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} className="w-full p-2 border rounded-md" required />
                    </div>
                </div>
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

export default SmsGateway;
