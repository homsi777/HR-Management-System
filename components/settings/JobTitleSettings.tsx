import React, { useState } from 'react';
import { JobTitle, Department, IElectronAPI } from '../../types';
import Modal from '../ui/Modal';
import { ICONS } from '../../constants';

interface JobTitleSettingsProps {
    jobTitles: JobTitle[];
    departments: Department[];
    refreshData: () => Promise<void>;
    api: IElectronAPI;
    setToast: (toast: { message: string, type: 'success' | 'error' }) => void;
}

const JobTitleSettings: React.FC<JobTitleSettingsProps> = ({ jobTitles, departments, refreshData, api, setToast }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedJob, setSelectedJob] = useState<JobTitle | null>(null);
    const [formData, setFormData] = useState<Omit<JobTitle, 'id'>>({ name: '', departmentId: 0, description: '' });

    const getDepartmentName = (id: number) => departments.find(d => d.id === id)?.name || 'N/A';

    const handleAdd = () => {
        if (departments.length === 0) {
            setToast({ message: 'الرجاء إضافة قسم واحد على الأقل قبل إضافة مسمى وظيفي.', type: 'error' });
            return;
        }
        setSelectedJob(null);
        setFormData({ name: '', departmentId: departments[0]?.id || 0, description: '' });
        setIsModalOpen(true);
    };

    const handleEdit = (job: JobTitle) => {
        setSelectedJob(job);
        setFormData(job);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذا المسمى الوظيفي؟')) {
            await api.db.delete('jobTitles', id);
            await refreshData();
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedJob) {
            await api.db.update('jobTitles', selectedJob.id, formData);
            setToast({ message: 'تم تحديث المسمى الوظيفي بنجاح.', type: 'success' });
            await refreshData();
            setIsModalOpen(false);
        } else {
            await api.db.insert('jobTitles', formData);
            setToast({ message: 'تمت إضافة المسمى الوظيفي بنجاح.', type: 'success' });
            await refreshData();
            setFormData({ name: '', departmentId: formData.departmentId, description: '' }); // Reset form for next entry
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'departmentId' ? Number(value) : value }));
    };

    return (
         <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-neutral">إدارة المسميات الوظيفية</h3>
                <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition">إضافة مسمى جديد</button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6">المسمى الوظيفي</th>
                            <th className="py-3 px-6">القسم</th>
                            <th className="py-3 px-6">الوصف</th>
                            <th className="py-3 px-6">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {jobTitles.map(job => (
                            <tr key={job.id}>
                                <td className="py-4 px-6">{job.name}</td>
                                <td className="py-4 px-6">{getDepartmentName(job.departmentId)}</td>
                                <td className="py-4 px-6">{job.description}</td>
                                <td className="py-4 px-6 space-x-2 space-x-reverse">
                                    <button onClick={() => handleEdit(job)} className="text-primary hover:text-primary-dark p-1">{React.cloneElement(ICONS.edit, {className: "h-5 w-5"})}</button>
                                    <button onClick={() => handleDelete(job.id)} className="text-red-600 hover:text-red-800 p-1">{React.cloneElement(ICONS.delete, {className: "h-5 w-5"})}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Modal title={selectedJob ? 'تعديل مسمى وظيفي' : 'إضافة مسمى وظيفي جديد'} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label>اسم المسمى الوظيفي</label><input name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded" required /></div>
                    <div><label>القسم</label><select name="departmentId" value={formData.departmentId} onChange={handleChange} className="w-full p-2 border rounded bg-white" required>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select></div>
                    <div><label>الوصف</label><textarea name="description" value={formData.description} onChange={handleChange} className="w-full p-2 border rounded" rows={3}></textarea></div>
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">{selectedJob ? 'حفظ' : 'إضافة'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default JobTitleSettings;