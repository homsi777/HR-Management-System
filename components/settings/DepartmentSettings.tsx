import React, { useState } from 'react';
import { Department, Branch, Employee, IElectronAPI } from '../../types';
import Modal from '../ui/Modal';
import { ICONS } from '../../constants';

interface DepartmentSettingsProps {
    departments: Department[];
    branches: Branch[];
    employees: Employee[];
    refreshData: () => Promise<void>;
    api: IElectronAPI;
    setToast: (toast: { message: string, type: 'success' | 'error' }) => void;
}

const DepartmentSettings: React.FC<DepartmentSettingsProps> = ({ departments, branches, employees, refreshData, api, setToast }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDept, setSelectedDept] = useState<Department | null>(null);
    const [formData, setFormData] = useState<Omit<Department, 'id'>>({ name: '', branchId: 0, managerId: null });

    const getBranchName = (id: number) => branches.find(b => b.id === id)?.name || 'N/A';
    const getManagerName = (id: number | null) => id ? employees.find(e => e.id === id)?.name : 'لا يوجد';

    const handleAdd = () => {
        if (branches.length === 0) {
            setToast({ message: 'الرجاء إضافة فرع واحد على الأقل قبل إضافة قسم.', type: 'error' });
            return;
        }
        setSelectedDept(null);
        setFormData({ name: '', branchId: branches[0]?.id || 0, managerId: null });
        setIsModalOpen(true);
    };

    const handleEdit = (dept: Department) => {
        setSelectedDept(dept);
        setFormData(dept);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذا القسم؟')) {
            await api.db.delete('departments', id);
            await refreshData();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedDept) {
            await api.db.update('departments', selectedDept.id, formData);
            setToast({ message: 'تم تحديث القسم بنجاح.', type: 'success' });
            await refreshData();
            setIsModalOpen(false);
        } else {
            await api.db.insert('departments', formData);
            setToast({ message: 'تمت إضافة القسم بنجاح.', type: 'success' });
            await refreshData();
            setFormData({ name: '', branchId: formData.branchId, managerId: null }); // Reset form for next entry
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumeric = ['branchId', 'managerId'].includes(name);
        let finalValue: string | number | null = value;
        if (isNumeric) {
            finalValue = value ? Number(value) : null;
        }
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-neutral">إدارة الأقسام</h3>
                <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition">إضافة قسم جديد</button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6">اسم القسم</th>
                            <th className="py-3 px-6">الفرع</th>
                            <th className="py-3 px-6">المدير المسؤول</th>
                            <th className="py-3 px-6">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {departments.map(dept => (
                            <tr key={dept.id}>
                                <td className="py-4 px-6">{dept.name}</td>
                                <td className="py-4 px-6">{getBranchName(dept.branchId)}</td>
                                <td className="py-4 px-6">{getManagerName(dept.managerId)}</td>
                                <td className="py-4 px-6 space-x-2 space-x-reverse">
                                    <button onClick={() => handleEdit(dept)} className="text-primary hover:text-primary-dark p-1">{React.cloneElement(ICONS.edit, {className: "h-5 w-5"})}</button>
                                    <button onClick={() => handleDelete(dept.id)} className="text-red-600 hover:text-red-800 p-1">{React.cloneElement(ICONS.delete, {className: "h-5 w-5"})}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Modal title={selectedDept ? 'تعديل قسم' : 'إضافة قسم جديد'} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label>اسم القسم</label><input name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded" required /></div>
                    <div><label>الفرع</label><select name="branchId" value={formData.branchId} onChange={handleChange} className="w-full p-2 border rounded bg-white" required>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select></div>
                    <div><label>المدير المسؤول</label><select name="managerId" value={formData.managerId || ''} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                        <option value="">-- لا يوجد --</option>
                        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select></div>
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">{selectedDept ? 'حفظ' : 'إضافة'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default DepartmentSettings;