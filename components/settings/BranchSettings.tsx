import React, { useState } from 'react';
import { Branch, Employee, IElectronAPI } from '../../types';
import Modal from '../ui/Modal';
import { ICONS } from '../../constants';

interface BranchSettingsProps {
    branches: Branch[];
    employees: Employee[];
    refreshData: () => Promise<void>;
    api: IElectronAPI;
    setToast: (toast: { message: string, type: 'success' | 'error' }) => void;
}

const BranchSettings: React.FC<BranchSettingsProps> = ({ branches, employees, refreshData, api, setToast }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
    const [formData, setFormData] = useState<Omit<Branch, 'id'>>({ name: '', address: '', managerId: null, branchCode: '' });

    const getManagerName = (id: number | null) => id ? employees.find(e => e.id === id)?.name : 'لا يوجد';

    const handleAdd = () => {
        setSelectedBranch(null);
        setFormData({ name: '', address: '', managerId: null, branchCode: `BR-${Date.now().toString().slice(-4)}` });
        setIsModalOpen(true);
    };

    const handleEdit = (branch: Branch) => {
        setSelectedBranch(branch);
        setFormData(branch);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذا الفرع؟')) {
            await api.db.delete('branches', id);
            await refreshData();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedBranch) {
            await api.db.update('branches', selectedBranch.id, formData);
            setToast({ message: 'تم تحديث الفرع بنجاح.', type: 'success' });
            await refreshData();
            setIsModalOpen(false);
        } else {
            await api.db.insert('branches', formData);
            setToast({ message: 'تمت إضافة الفرع بنجاح.', type: 'success' });
            await refreshData();
            setFormData({ name: '', address: '', managerId: null, branchCode: `BR-${Date.now().toString().slice(-4)}` }); // Reset form for next entry
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'managerId' ? (value ? Number(value) : null) : value }));
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-neutral">إدارة الفروع</h3>
                <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition">إضافة فرع جديد</button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6">كود الفرع</th>
                            <th className="py-3 px-6">اسم الفرع</th>
                            <th className="py-3 px-6">العنوان</th>
                            <th className="py-3 px-6">المدير المسؤول</th>
                            <th className="py-3 px-6">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {branches.map(branch => (
                            <tr key={branch.id}>
                                <td className="py-4 px-6">{branch.branchCode}</td>
                                <td className="py-4 px-6">{branch.name}</td>
                                <td className="py-4 px-6">{branch.address}</td>
                                <td className="py-4 px-6">{getManagerName(branch.managerId)}</td>
                                <td className="py-4 px-6 space-x-2 space-x-reverse">
                                    <button onClick={() => handleEdit(branch)} className="text-primary hover:text-primary-dark p-1">{React.cloneElement(ICONS.edit, {className: "h-5 w-5"})}</button>
                                    <button onClick={() => handleDelete(branch.id)} className="text-red-600 hover:text-red-800 p-1">{React.cloneElement(ICONS.delete, {className: "h-5 w-5"})}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Modal title={selectedBranch ? 'تعديل فرع' : 'إضافة فرع جديد'} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label>اسم الفرع</label><input name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded" required /></div>
                    <div><label>كود الفرع</label><input name="branchCode" value={formData.branchCode} onChange={handleChange} className="w-full p-2 border rounded" required /></div>
                    <div><label>العنوان</label><input name="address" value={formData.address} onChange={handleChange} className="w-full p-2 border rounded" /></div>
                    <div><label>المدير المسؤول</label><select name="managerId" value={formData.managerId || ''} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                        <option value="">-- لا يوجد --</option>
                        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select></div>
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">{selectedBranch ? 'حفظ' : 'إضافة'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default BranchSettings;