import React, { useState, useMemo } from 'react';
import { Custody, Employee, IElectronAPI } from '../types';
import Modal from './ui/Modal';
import { ICONS } from '../constants';

interface CustodyProps {
    custody: Custody[];
    employees: Employee[];
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' }) => void;
    api: IElectronAPI;
}

const initialItems = Array(10).fill('');

const CustodyComponent: React.FC<CustodyProps> = ({ custody, employees, refreshData, setToast, api }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCustody, setSelectedCustody] = useState<Custody | null>(null);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
    const [items, setItems] = useState<string[]>(initialItems);
    const [notes, setNotes] = useState('');

    const getEmployeeName = (employeeId: number) => {
        return employees.find(e => e.id === employeeId)?.name || 'N/A';
    };

    const handleAdd = () => {
        setSelectedCustody(null);
        setSelectedEmployeeId(employees.find(e => e.status === 'active')?.id || '');
        setItems(initialItems);
        setNotes('');
        setIsModalOpen(true);
    };

    const handleEdit = (record: Custody) => {
        setSelectedCustody(record);
        setSelectedEmployeeId(record.employeeId);
        const currentItems = [...initialItems];
        record.items.forEach((item, i) => {
            if (i < initialItems.length) {
                currentItems[i] = item;
            }
        });
        setItems(currentItems);
        setNotes(record.notes || '');
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف سجل الأمانات هذا؟')) {
            await api.db.delete('custody', id);
            await refreshData();
            setToast({ message: 'تم حذف السجل بنجاح.', type: 'success' });
        }
    };

    const handleItemChange = (index: number, value: string) => {
        const newItems = [...items];
        newItems[index] = value;
        setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployeeId) {
            setToast({ message: 'يرجى اختيار موظف.', type: 'error' });
            return;
        }

        const filteredItems = items.filter(item => item.trim() !== '');
        if (filteredItems.length === 0) {
            setToast({ message: 'يرجى إدخال أمانة واحدة على الأقل.', type: 'error' });
            return;
        }

        const custodyData = {
            employeeId: Number(selectedEmployeeId),
            items: filteredItems,
            date: selectedCustody ? selectedCustody.date : new Date().toISOString().split('T')[0],
            notes: notes
        };

        if (selectedCustody) {
            await api.db.update('custody', selectedCustody.id, custodyData);
            setToast({ message: 'تم تحديث سجل الأمانات بنجاح.', type: 'success' });
        } else {
            await api.db.insert('custody', custodyData);
            setToast({ message: 'تمت إضافة سجل الأمانات بنجاح.', type: 'success' });
        }

        await refreshData();
        setIsModalOpen(false);
    };
    
    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-neutral">إدارة الأمانات</h2>
                <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition">إضافة أمانة</button>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-x-auto">
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6 font-medium">اسم الموظف</th>
                            <th className="py-3 px-6 font-medium">تاريخ التسليم</th>
                            <th className="py-3 px-6 font-medium">الأمانات المستلمة</th>
                            <th className="py-3 px-6 font-medium">ملاحظات</th>
                            <th className="py-3 px-6">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {custody.map(record => (
                            <tr key={record.id}>
                                <td className="py-4 px-6 font-semibold">{getEmployeeName(record.employeeId)}</td>
                                <td className="py-4 px-6">{record.date}</td>
                                <td className="py-4 px-6">
                                    <ul className="list-disc pr-4 space-y-1">
                                        {record.items.map((item, index) => <li key={index}>{item}</li>)}
                                    </ul>
                                </td>
                                <td className="py-4 px-6 text-sm text-gray-600">{record.notes}</td>
                                <td className="py-4 px-6 space-x-2 space-x-reverse">
                                    <button onClick={() => handleEdit(record)} className="text-primary hover:text-primary-dark p-1" title="تعديل">{React.cloneElement(ICONS.edit, {className: "h-5 w-5"})}</button>
                                    <button onClick={() => handleDelete(record.id)} className="text-red-600 hover:text-red-800 p-1" title="حذف">{React.cloneElement(ICONS.delete, { className: "h-5 w-5" })}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <Modal title={selectedCustody ? "تعديل سجل أمانات" : "إضافة سجل أمانات جديد"} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="large">
                <form onSubmit={handleSubmit} className="p-2 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">اختيار الموظف</label>
                        <select 
                            value={selectedEmployeeId} 
                            onChange={e => setSelectedEmployeeId(Number(e.target.value))} 
                            className="w-full p-2 border rounded-md bg-white disabled:bg-gray-100" 
                            required
                            disabled={!!selectedCustody}
                        >
                            <option value="" disabled>-- اختر موظفًا --</option>
                            {employees.filter(e => e.status === 'active').map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                    </div>

                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-2">قائمة الأمانات المستلمة (10 كحد أقصى)</label>
                         <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            {items.map((item, index) => (
                                <input
                                    key={index}
                                    type="text"
                                    placeholder={`أمانة ${index + 1}`}
                                    value={item}
                                    onChange={(e) => handleItemChange(index, e.target.value)}
                                    className="w-full p-2 border rounded-md"
                                />
                            ))}
                         </div>
                    </div>

                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full p-2 border rounded-md"></textarea>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">{selectedCustody ? 'حفظ التعديلات' : 'حفظ'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default CustodyComponent;