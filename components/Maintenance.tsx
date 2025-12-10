import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { MaintenanceStaff, Employee, Department, IElectronAPI } from '../types';
import Modal from './ui/Modal';
import { ICONS } from '../constants';

interface MaintenanceProps {
    maintenanceStaff: MaintenanceStaff[];
    employees: Employee[];
    departments: Department[];
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' }) => void;
    api: IElectronAPI;
}

const initialFormData: Omit<MaintenanceStaff, 'id'> = {
    employeeId: 0,
};

const Maintenance: React.FC<MaintenanceProps> = ({ maintenanceStaff, employees, departments, refreshData, setToast, api }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<MaintenanceStaff | null>(null);
    const [formData, setFormData] = useState<Omit<MaintenanceStaff, 'id'>>(initialFormData);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDepartment, setFilterDepartment] = useState<'all' | number>('all');

    const getEmployeeDetails = (employeeId: number) => {
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return { name: 'N/A', departmentName: 'N/A', departmentId: 0, phone: 'N/A' };
        const dept = departments.find(d => d.id === emp.departmentId);
        return { name: emp.name, departmentName: dept?.name || 'N/A', departmentId: emp.departmentId, phone: emp.phone };
    };

    const enhancedStaff = useMemo(() => {
        return maintenanceStaff.map(staff => {
            const details = getEmployeeDetails(staff.employeeId);
            return {
                ...staff,
                employeeName: details.name,
                departmentName: details.departmentName,
                departmentId: details.departmentId,
                phone: details.phone
            };
        }).filter(staff => {
            const searchMatch = staff.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
            const departmentMatch = filterDepartment === 'all' || staff.departmentId === filterDepartment;
            return searchMatch && departmentMatch;
        });
    }, [maintenanceStaff, employees, departments, searchTerm, filterDepartment]);
    
    const employeesForDropdown = useMemo(() => {
        const assignedEmployeeIds = new Set(maintenanceStaff.map(r => r.employeeId));
        const unassigned = employees.filter(e => !assignedEmployeeIds.has(e.id) && e.status === 'active');
        if (selectedStaff) {
            const currentStaffEmployee = employees.find(e => e.id === selectedStaff.employeeId);
            if (currentStaffEmployee) {
                return [currentStaffEmployee, ...unassigned].sort((a,b) => a.name.localeCompare(b.name));
            }
        }
        return unassigned;
    }, [employees, maintenanceStaff, selectedStaff]);
    
    const handleAdd = () => {
        setSelectedStaff(null);
        setFormData({ ...initialFormData, employeeId: employeesForDropdown[0]?.id || 0 });
        setIsModalOpen(true);
    };

    const handleEdit = (staff: MaintenanceStaff) => {
        setSelectedStaff(staff);
        setFormData(staff);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذا الموظف من فريق الصيانة؟ سيتم إزالة دوره فقط ولن يتم حذف الموظف.')) {
            await api.db.delete('maintenance_staff', id);
            await refreshData();
            setToast({ message: 'تم حذف موظف الصيانة بنجاح.', type: 'success' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.employeeId) {
            setToast({ message: 'الرجاء اختيار موظف.', type: 'error' });
            return;
        }
        
        const dataToSubmit = {
            employeeId: formData.employeeId,
        };

        if (selectedStaff) {
            await api.db.update('maintenance_staff', selectedStaff.id, dataToSubmit);
            setToast({ message: 'تم تحديث بيانات موظف الصيانة بنجاح.', type: 'success' });
        } else {
            await api.db.insert('maintenance_staff', dataToSubmit);
            setToast({ message: 'تمت إضافة موظف الصيانة بنجاح.', type: 'success' });
        }
        await refreshData();
        setIsModalOpen(false);
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: Number(value) }));
    };

    const handleExport = () => {
        const dataToExport = enhancedStaff.map(staff => ({
            'اسم الموظف': staff.employeeName,
            'القسم': staff.departmentName,
            'الهاتف': staff.phone,
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MaintenanceStaff");
        XLSX.writeFile(wb, "maintenance_staff_report.xlsx");
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-neutral">إدارة فريق الصيانة</h2>
                <div>
                    <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2 mr-2">{ICONS.export} تصدير</button>
                    <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition">إضافة موظف صيانة</button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-md mb-6 flex items-center gap-4">
                <input type="text" placeholder="بحث باسم الموظف..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 border rounded-lg bg-white w-1/3"/>
                <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="p-2 border rounded-lg bg-white w-1/4">
                    <option value="all">كل الأقسام</option>
                    {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                </select>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-x-auto">
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6 font-medium">اسم الموظف</th>
                            <th className="py-3 px-6 font-medium">القسم</th>
                            <th className="py-3 px-6 font-medium">الهاتف</th>
                            <th className="py-3 px-6">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {enhancedStaff.map(staff => (
                            <tr key={staff.id}>
                                <td className="py-4 px-6">{staff.employeeName}</td>
                                <td className="py-4 px-6">{staff.departmentName}</td>
                                <td className="py-4 px-6">{staff.phone}</td>
                                <td className="py-4 px-6 space-x-2 space-x-reverse">
                                    <button onClick={() => handleEdit(staff)} className="text-primary hover:text-primary-dark p-1">{React.cloneElement(ICONS.edit, {className: "h-5 w-5"})}</button>
                                    <button onClick={() => handleDelete(staff.id)} className="text-red-600 hover:text-red-800 p-1">{React.cloneElement(ICONS.delete, {className: "h-5 w-5"})}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <Modal title={selectedStaff ? 'تعديل بيانات موظف الصيانة' : 'إضافة موظف صيانة جديد'} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <form onSubmit={handleSubmit} className="p-2 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">اختيار الموظف</label>
                        <select name="employeeId" value={formData.employeeId} onChange={handleChange} className="w-full p-2 border rounded-md bg-white" required>
                            <option value={0} disabled>-- اختر موظفًا --</option>
                            {employeesForDropdown.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                            {employeesForDropdown.length === 0 && <option disabled>لا يوجد موظفين متاحين</option>}
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">{selectedStaff ? 'حفظ التعديلات' : 'إضافة موظف'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Maintenance;
