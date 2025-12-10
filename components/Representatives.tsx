import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Representative, Employee, Department, IElectronAPI } from '../types';
import Modal from './ui/Modal';
import { ICONS } from '../constants';

interface RepresentativesProps {
    representatives: Representative[];
    employees: Employee[];
    departments: Department[];
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' }) => void;
    api: IElectronAPI;
}

const initialFormData: Omit<Representative, 'id'> = {
    employeeId: 0,
    carType: '',
    carPlateNumber: '',
    assignedArea: '',
    notes: ''
};

const Representatives: React.FC<RepresentativesProps> = ({ representatives, employees, departments, refreshData, setToast, api }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRep, setSelectedRep] = useState<Representative | null>(null);
    const [formData, setFormData] = useState<Omit<Representative, 'id'>>(initialFormData);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDepartment, setFilterDepartment] = useState<'all' | number>('all');

    const getEmployeeDetails = (employeeId: number) => {
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return { name: 'N/A', departmentName: 'N/A', departmentId: 0 };
        const dept = departments.find(d => d.id === emp.departmentId);
        return { name: emp.name, departmentName: dept?.name || 'N/A', departmentId: emp.departmentId };
    };

    const enhancedReps = useMemo(() => {
        return representatives.map(rep => {
            const details = getEmployeeDetails(rep.employeeId);
            return {
                ...rep,
                employeeName: details.name,
                departmentName: details.departmentName,
                departmentId: details.departmentId,
            };
        }).filter(rep => {
            const searchMatch = rep.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
            const departmentMatch = filterDepartment === 'all' || rep.departmentId === filterDepartment;
            return searchMatch && departmentMatch;
        });
    }, [representatives, employees, departments, searchTerm, filterDepartment]);
    
    const employeesForDropdown = useMemo(() => {
        const assignedEmployeeIds = new Set(representatives.map(r => r.employeeId));
        const unassigned = employees.filter(e => !assignedEmployeeIds.has(e.id) && e.status === 'active');
        if (selectedRep) {
            const currentRepEmployee = employees.find(e => e.id === selectedRep.employeeId);
            if (currentRepEmployee) {
                // Add the current employee to the list so they can be selected
                return [currentRepEmployee, ...unassigned].sort((a,b) => a.name.localeCompare(b.name));
            }
        }
        return unassigned;
    }, [employees, representatives, selectedRep]);
    
    const handleAdd = () => {
        setSelectedRep(null);
        setFormData({ ...initialFormData, employeeId: employeesForDropdown[0]?.id || 0 });
        setIsModalOpen(true);
    };

    const handleEdit = (rep: Representative) => {
        setSelectedRep(rep);
        setFormData(rep);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذا المندوب؟ سيتم إزالة دوره كمندوب فقط ولن يتم حذف الموظف.')) {
            await api.db.delete('representatives', id);
            await refreshData();
            setToast({ message: 'تم حذف المندوب بنجاح.', type: 'success' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.employeeId) {
            setToast({ message: 'الرجاء اختيار موظف.', type: 'error' });
            return;
        }
        
        // Explicitly create an object with only the fields that exist in the database table.
        // This prevents sending extra fields like 'employeeName' which are used for display only.
        const dataToSubmit = {
            employeeId: formData.employeeId,
            carType: (formData as Representative).carType,
            carPlateNumber: (formData as Representative).carPlateNumber,
            assignedArea: (formData as Representative).assignedArea,
            notes: (formData as Representative).notes,
        };

        if (selectedRep) {
            await api.db.update('representatives', selectedRep.id, dataToSubmit);
            setToast({ message: 'تم تحديث بيانات المندوب بنجاح.', type: 'success' });
        } else {
            await api.db.insert('representatives', dataToSubmit);
            setToast({ message: 'تم إضافة المندوب بنجاح.', type: 'success' });
        }
        await refreshData();
        setIsModalOpen(false);
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'employeeId' ? Number(value) : value }));
    };

    const handleExport = () => {
        const dataToExport = enhancedReps.map(rep => ({
            'اسم المندوب': rep.employeeName,
            'القسم': rep.departmentName,
            'نوع السيارة': rep.carType,
            'رقم اللوحة': rep.carPlateNumber,
            'المنطقة المسؤولة': rep.assignedArea,
            'ملاحظات': rep.notes,
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Representatives");
        XLSX.writeFile(wb, "representatives_report.xlsx");
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-neutral">إدارة المناديب</h2>
                <div>
                    <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2 mr-2">{ICONS.export} تصدير</button>
                    <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition">إضافة مندوب جديد</button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-md mb-6 flex items-center gap-4">
                <input type="text" placeholder="بحث باسم المندوب..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 border rounded-lg bg-white w-1/3"/>
                <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="p-2 border rounded-lg bg-white w-1/4">
                    <option value="all">كل الأقسام</option>
                    {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                </select>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-x-auto">
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6 font-medium">اسم المندوب</th>
                            <th className="py-3 px-6 font-medium">القسم</th>
                            <th className="py-3 px-6 font-medium">نوع السيارة</th>
                            <th className="py-3 px-6 font-medium">رقم اللوحة</th>
                            <th className="py-3 px-6 font-medium">المنطقة المسؤولة</th>
                            <th className="py-3 px-6">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {enhancedReps.map(rep => (
                            <tr key={rep.id}>
                                <td className="py-4 px-6">{rep.employeeName}</td>
                                <td className="py-4 px-6">{rep.departmentName}</td>
                                <td className="py-4 px-6">{rep.carType}</td>
                                <td className="py-4 px-6">{rep.carPlateNumber}</td>
                                <td className="py-4 px-6">{rep.assignedArea}</td>
                                <td className="py-4 px-6 space-x-2 space-x-reverse">
                                    <button onClick={() => handleEdit(rep)} className="text-primary hover:text-primary-dark p-1">{React.cloneElement(ICONS.edit, {className: "h-5 w-5"})}</button>
                                    <button onClick={() => handleDelete(rep.id)} className="text-red-600 hover:text-red-800 p-1">{React.cloneElement(ICONS.delete, {className: "h-5 w-5"})}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <Modal title={selectedRep ? 'تعديل بيانات مندوب' : 'إضافة مندوب جديد'} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <form onSubmit={handleSubmit} className="p-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">اختيار الموظف</label>
                        <select name="employeeId" value={formData.employeeId} onChange={handleChange} className="w-full p-2 border rounded-md bg-white" required>
                            <option value={0} disabled>-- اختر موظفًا --</option>
                            {employeesForDropdown.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                            {employeesForDropdown.length === 0 && <option disabled>لا يوجد موظفين متاحين</option>}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">المنطقة المسؤولة</label>
                        <input name="assignedArea" value={formData.assignedArea} onChange={handleChange} className="w-full p-2 border rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">نوع السيارة</label>
                        <input name="carType" value={formData.carType} onChange={handleChange} className="w-full p-2 border rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">رقم لوحة السيارة</label>
                        <input name="carPlateNumber" value={formData.carPlateNumber} onChange={handleChange} className="w-full p-2 border rounded-md" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات (المهام/المواد)</label>
                        <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className="w-full p-2 border rounded-md"></textarea>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 border-t pt-4 md:col-span-2">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">{selectedRep ? 'حفظ التعديلات' : 'إضافة مندوب'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Representatives;