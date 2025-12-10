import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { PhoneBookCategory, PhoneBookContact, IElectronAPI, SMSPriority } from '../types';
import Modal from './ui/Modal';
import { ICONS } from '../constants';

// Props
interface PhoneBookProps {
    categories: PhoneBookCategory[];
    contacts: PhoneBookContact[];
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
    api: IElectronAPI;
}

// Main Component
const PhoneBook: React.FC<PhoneBookProps> = ({ categories, contacts, refreshData, setToast, api }) => {
    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<'all' | number>('all');
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [selectedContact, setSelectedContact] = useState<PhoneBookContact | null>(null);
    const [contactFormData, setContactFormData] = useState<Omit<PhoneBookContact, 'id'>>({ name: '', phone: '', categoryId: 0, notes: '' });
    const [newCategoryName, setNewCategoryName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
    const [smsTarget, setSmsTarget] = useState<{name: string, phone: string} | null>(null);
    
    // Memos
    const filteredContacts = useMemo(() => {
        let contactsToFilter = contacts;

        // Filter by category
        if (filterCategory !== 'all') {
            contactsToFilter = contactsToFilter.filter(contact => contact.categoryId === filterCategory);
        }

        // Filter by search term
        if (searchTerm) {
            contactsToFilter = contactsToFilter.filter(contact =>
                contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                contact.phone.includes(searchTerm)
            );
        }

        return contactsToFilter;
    }, [contacts, searchTerm, filterCategory]);
    
    // Handlers: Categories
    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) {
            setToast({ message: 'يرجى إدخال اسم فئة صالح.', type: 'error' });
            return;
        }
        await api.db.insert('phone_book_categories', { name: newCategoryName });
        setNewCategoryName('');
        await refreshData();
        setToast({ message: 'تمت إضافة الفئة بنجاح.', type: 'success' });
    };

    const handleDeleteCategory = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذه الفئة؟ سيتم حذف جميع جهات الاتصال المرتبطة بها.')) {
            await api.db.delete('phone_book_categories', id);
            await refreshData();
            setToast({ message: 'تم حذف الفئة.', type: 'success' });
        }
    };
    
    // Handlers: Contacts
    const handleOpenContactModal = (contact: PhoneBookContact | null = null) => {
        setSelectedContact(contact);
        if (contact) {
            setContactFormData(contact);
        } else {
            setContactFormData({ name: '', phone: '', categoryId: categories[0]?.id || 0, notes: '' });
        }
        setIsContactModalOpen(true);
    };

    const handleOpenSmsModal = (contact: PhoneBookContact) => {
        if (!contact.phone) {
            setToast({ message: 'لا يوجد رقم هاتف مسجل لجهة الاتصال هذه.', type: 'error' });
            return;
        }
        setSmsTarget({ name: contact.name, phone: contact.phone });
        setIsSmsModalOpen(true);
    };

    const handleContactFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setContactFormData(prev => ({ ...prev, [name]: name === 'categoryId' ? Number(value) : value }));
    };

    const handleContactSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedContact) {
            await api.db.update('phone_book_contacts', selectedContact.id, contactFormData);
            setToast({ message: 'تم تحديث جهة الاتصال.', type: 'success' });
        } else {
            await api.db.insert('phone_book_contacts', contactFormData);
            setToast({ message: 'تمت إضافة جهة الاتصال.', type: 'success' });
        }
        await refreshData();
        setIsContactModalOpen(false);
    };

    const handleDeleteContact = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف جهة الاتصال هذه؟')) {
            await api.db.delete('phone_book_contacts', id);
            await refreshData();
            setToast({ message: 'تم حذف جهة الاتصال.', type: 'success' });
        }
    };
    
    const handleCopyPhone = (phone: string) => {
        const textArea = document.createElement("textarea");
        textArea.value = phone;
        
        // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                setToast({ message: `تم نسخ الرقم ${phone} بنجاح!`, type: 'success' });
            } else {
                setToast({ message: 'فشل النسخ. حاول النسخ يدوياً.', type: 'error' });
            }
        } catch (err) {
            setToast({ message: 'فشل النسخ. حاول النسخ يدوياً.', type: 'error' });
            console.error('Fallback: Oops, unable to copy', err);
        }

        document.body.removeChild(textArea);
    };

    // Handler: Import
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setToast({ message: 'جاري استيراد الملف...', type: 'info' });

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                let createdCategories = 0;
                let createdContacts = 0;
                
                const existingCategories = [...categories];

                for (const row of json as any[]) {
                    const name = row['Name'] || `${row['Given Name'] || ''} ${row['Family Name'] || ''}`.trim();
                    const phone = row['Phone 1 - Value'];
                    const group = row['Group Membership']?.split(' ::: ')[0] || 'مستورد'; // Take the first group if multiple
                    
                    if (!name || !phone) continue;

                    let category = existingCategories.find(c => c.name === group);
                    if (!category) {
                        const newCategory = await api.db.insert('phone_book_categories', { name: group });
                        existingCategories.push(newCategory);
                        category = newCategory;
                        createdCategories++;
                    }
                    
                    await api.db.insert('phone_book_contacts', { name, phone, categoryId: category.id, notes: 'مستورد من CSV' });
                    createdContacts++;
                }

                await refreshData();
                setToast({ message: `تم الاستيراد بنجاح! ${createdContacts} جهة اتصال، ${createdCategories} فئة جديدة.`, type: 'success' });
            };
            reader.readAsArrayBuffer(file);
        } catch (error) {
            console.error("CSV Import Error:", error);
            setToast({ message: 'فشل استيراد الملف. تأكد من أنه ملف CSV صالح.', type: 'error' });
        } finally {
            // Reset file input
            if (e.target) e.target.value = '';
        }
    };


    // JSX
    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-neutral">دفتر الهاتف</h2>
                <div className="flex items-center gap-2">
                    <input ref={fileInputRef} type="file" className="hidden" accept=".csv" onChange={handleFileImport} />
                    <button onClick={handleImportClick} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition flex items-center gap-2">
                        {React.cloneElement(ICONS.export, {className: "h-5 w-5"})} استيراد CSV
                    </button>
                    <button onClick={() => setIsCategoryModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">إدارة الفئات</button>
                    <button onClick={() => handleOpenContactModal()} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition">إضافة جهة اتصال</button>
                </div>
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow-md mb-6 flex items-center gap-4">
                <input
                    type="text"
                    placeholder="بحث بالاسم أو رقم الهاتف..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="p-2 border rounded-lg bg-white w-1/3"
                />
                 <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="p-2 border rounded-lg bg-white w-1/4"
                >
                    <option value="all">كل الفئات</option>
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
            </div>
            
            <div className="bg-white rounded-xl shadow-md overflow-x-auto">
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6 font-medium">الاسم</th>
                            <th className="py-3 px-6 font-medium">رقم الهاتف</th>
                            <th className="py-3 px-6 font-medium">الفئة</th>
                            <th className="py-3 px-6 font-medium">ملاحظات</th>
                            <th className="py-3 px-6">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredContacts.map(contact => (
                            <tr key={contact.id}>
                                <td className="py-4 px-6 font-semibold">{contact.name}</td>
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-2 justify-start">
                                        <span>{contact.phone}</span>
                                        <button onClick={() => handleCopyPhone(contact.phone)} className="text-gray-400 hover:text-gray-600" title="نسخ الرقم">
                                            {React.cloneElement(ICONS.copy, { className: "h-4 w-4" })}
                                        </button>
                                    </div>
                                </td>
                                <td className="py-4 px-6">
                                    {categories.find(c => c.id === contact.categoryId)?.name || 'غير مصنف'}
                                </td>
                                <td className="py-4 px-6 text-sm text-gray-600">{contact.notes}</td>
                                <td className="py-4 px-6 space-x-2 space-x-reverse">
                                    <button onClick={() => handleOpenSmsModal(contact)} className="text-sky-600 hover:text-sky-800 p-1" title="إرسال رسالة">{React.cloneElement(ICONS.sms, {className: "h-5 w-5"})}</button>
                                    <button onClick={() => handleOpenContactModal(contact)} className="text-primary hover:text-primary-dark p-1">{React.cloneElement(ICONS.edit, {className: "h-5 w-5"})}</button>
                                    <button onClick={() => handleDeleteContact(contact.id)} className="text-red-600 hover:text-red-800 p-1">{React.cloneElement(ICONS.delete, {className: "h-5 w-5"})}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredContacts.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        <p>لا توجد جهات اتصال لعرضها. {searchTerm || filterCategory !== 'all' ? 'جرّب تعديل الفلاتر.' : 'ابدأ بإضافة جهة اتصال جديدة.'}</p>
                    </div>
                )}
            </div>

            {/* Category Management Modal */}
            <Modal title="إدارة فئات دفتر الهاتف" isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)}>
                <div className="p-2 space-y-4">
                    <div>
                        <h4 className="font-semibold mb-2">إضافة فئة جديدة</h4>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="اسم الفئة (مثال: عملاء، موردون)"
                                value={newCategoryName}
                                onChange={e => setNewCategoryName(e.target.value)}
                                className="w-full p-2 border rounded-md"
                            />
                            <button onClick={handleAddCategory} className="bg-primary text-white px-4 rounded-lg hover:bg-primary-dark">إضافة</button>
                        </div>
                    </div>
                    <div className="border-t pt-4">
                        <h4 className="font-semibold mb-2">الفئات الحالية</h4>
                        <ul className="max-h-60 overflow-y-auto space-y-2">
                            {categories.map(cat => (
                                <li key={cat.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                                    <span>{cat.name}</span>
                                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-500 hover:text-red-700">{React.cloneElement(ICONS.delete, {className: "h-5 w-5"})}</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </Modal>
            
            {/* Contact Modal */}
            <Modal title={selectedContact ? 'تعديل جهة اتصال' : 'إضافة جهة اتصال'} isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)}>
                <form onSubmit={handleContactSubmit} className="space-y-4 p-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label>
                        <input name="name" value={contactFormData.name} onChange={handleContactFormChange} className="w-full p-2 border rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
                        <input name="phone" value={contactFormData.phone} onChange={handleContactFormChange} className="w-full p-2 border rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
                        <select name="categoryId" value={contactFormData.categoryId} onChange={handleContactFormChange} className="w-full p-2 border rounded-md bg-white" required>
                             {categories.length === 0 ? <option disabled>يرجى إضافة فئة أولاً</option> : categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                        <textarea name="notes" value={contactFormData.notes} onChange={handleContactFormChange} rows={3} className="w-full p-2 border rounded-md"></textarea>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={() => setIsContactModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">{selectedContact ? 'حفظ' : 'إضافة'}</button>
                    </div>
                </form>
            </Modal>

            <SendSmsModal 
                isOpen={isSmsModalOpen} 
                onClose={() => setIsSmsModalOpen(false)}
                api={api}
                setToast={setToast}
                initialTarget={smsTarget}
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
    initialTarget?: { name: string, phone: string } | null;
}

const SendSmsModal: React.FC<SendSmsModalProps> = ({ isOpen, onClose, api, setToast, initialTarget }) => {
    const [text, setText] = useState('');
    const [priority, setPriority] = useState<SMSPriority>('MEDIUM');

    React.useEffect(() => {
        if (isOpen) {
            setText('');
            setPriority('MEDIUM');
        }
    }, [isOpen]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!initialTarget || !text.trim()) {
            setToast({ message: 'الهدف غير محدد أو الرسالة فارغة.', type: 'error' });
            return;
        }

        const result = await api.sms.send({
            recipientName: initialTarget.name,
            recipientPhone: initialTarget.phone,
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
        <Modal title={`إرسال رسالة إلى ${initialTarget?.name || ''}`} isOpen={isOpen} onClose={onClose}>
            <form onSubmit={handleSubmit} className="p-2 space-y-4">
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


export default PhoneBook;
