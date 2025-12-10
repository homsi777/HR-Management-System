
import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ManufacturingStaff, Employee, IElectronAPI, SalaryCurrency, ManufacturingMaterial, ProductionTask, ProductionTaskStatus } from '../types';
import Modal from './ui/Modal';
import { ICONS } from '../constants';

interface ManufacturingProps {
    manufacturingStaff: ManufacturingStaff[];
    employees: Employee[];
    materials: ManufacturingMaterial[];
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' }) => void;
    api: IElectronAPI;
}

const initialFormData: Omit<ManufacturingStaff, 'id'> = {
    employeeId: 0,
    flatSalary: 0,
    currency: 'SYP',
    period: 'Monthly',
    tasks: [],
    productionTasks: []
};

const currencyTranslations: Record<SalaryCurrency, string> = {
    'SYP': 'ليرة سوري',
    'USD': 'دولار أمريكي',
    'TRY': 'ليرة تركي'
};

const periodTranslations: Record<'Weekly' | 'Monthly', string> = {
    'Weekly': 'أسبوعي',
    'Monthly': 'شهري'
};

const statusTranslations: Record<ProductionTaskStatus, string> = {
    'Pending': 'قيد الانتظار',
    'In Progress': 'جاري التصنيع',
    'Completed': 'تم الإنجاز'
};

const statusColors: Record<ProductionTaskStatus, string> = {
    'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
    'Completed': 'bg-green-100 text-green-800 border-green-200'
};

const Manufacturing: React.FC<ManufacturingProps> = ({ manufacturingStaff, employees, materials, refreshData, setToast, api }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
    
    // Employee Card (Overview)
    const [isEmployeeCardOpen, setIsEmployeeCardOpen] = useState(false);
    const [viewingStaff, setViewingStaff] = useState<ManufacturingStaff | null>(null);

    // Task Detail (Smart Card)
    const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);
    
    const [selectedStaff, setSelectedStaff] = useState<ManufacturingStaff | null>(null);
    const [formData, setFormData] = useState<Omit<ManufacturingStaff, 'id'>>(initialFormData);
    
    const [selectedTaskStaffId, setSelectedTaskStaffId] = useState<number | null>(null);
    const [selectedTask, setSelectedTask] = useState<ProductionTask | null>(null);
    
    const [newMaterial, setNewMaterial] = useState<Omit<ManufacturingMaterial, 'id'>>({ name: '', price: 0, currency: 'SYP' });

    const [searchTerm, setSearchTerm] = useState('');
    const [biometricIdInput, setBiometricIdInput] = useState('');

    const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

    const getEmployeeName = (id: number) => employees.find(e => e.id === id)?.name || 'غير معروف';
    const getEmployeeBiometric = (id: number) => employees.find(e => e.id === id)?.biometricId || '';

    const filteredStaff = useMemo(() => {
        return manufacturingStaff.filter(staff => {
            const name = getEmployeeName(staff.employeeId).toLowerCase();
            return name.includes(searchTerm.toLowerCase());
        });
    }, [manufacturingStaff, employees, searchTerm]);

    const availableEmployees = useMemo(() => {
        const existingIds = new Set(manufacturingStaff.map(s => s.employeeId));
        return employees.filter(e => e.status === 'active' && (!existingIds.has(e.id) || (selectedStaff && selectedStaff.employeeId === e.id)));
    }, [employees, manufacturingStaff, selectedStaff]);

    const handleAdd = () => {
        setSelectedStaff(null);
        setFormData({ ...initialFormData, employeeId: availableEmployees[0]?.id || 0 });
        setBiometricIdInput('');
        setIsModalOpen(true);
    };

    const handleEdit = (staff: ManufacturingStaff) => {
        setSelectedStaff(staff);
        const tasksFromDb = (staff as any).production_tasks || staff.productionTasks || [];
        setFormData({
            ...staff,
            productionTasks: tasksFromDb
        });
        setBiometricIdInput(getEmployeeBiometric(staff.employeeId));
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذا الموظف من قسم التصنيع؟')) {
            await api.db.delete('manufacturing_staff', id);
            await refreshData();
            setToast({ message: 'تم الحذف بنجاح.', type: 'success' });
        }
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'employeeId' ? Number(value) : name === 'flatSalary' ? parseFloat(value) : value
        }));
        
        if (name === 'employeeId') {
            setBiometricIdInput(getEmployeeBiometric(Number(value)));
        }
    };

    // --- Production Tasks (Materials) Logic ---
    const addProductionTask = () => {
        if (materials.length === 0) {
            setToast({ message: 'يرجى تعريف مواد أولاً.', type: 'error' });
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        setFormData(prev => ({
            ...prev,
            productionTasks: [...(prev.productionTasks || []), { 
                id: generateId(),
                materialId: materials[0].id, 
                quantity: 1, 
                total: materials[0].price,
                startDate: today,
                endDate: today,
                status: 'Pending',
                notes: ''
            }]
        }));
    };

    const removeProductionTask = (index: number) => {
        setFormData(prev => ({
            ...prev,
            productionTasks: prev.productionTasks.filter((_, i) => i !== index)
        }));
    };

    const handleProductionTaskChange = (index: number, field: keyof ProductionTask | 'duration', value: any) => {
        setFormData(prev => {
            const newTasks = [...(prev.productionTasks || [])];
            const task = { ...newTasks[index] };

            if (field === 'materialId') {
                task.materialId = Number(value);
                const material = materials.find(m => m.id === Number(value));
                if (material) {
                    task.total = material.price * task.quantity;
                }
            } else if (field === 'quantity') {
                task.quantity = Number(value);
                const material = materials.find(m => m.id === task.materialId);
                if (material) {
                    task.total = material.price * Number(value);
                }
            } else if (field === 'duration') {
                const days = parseInt(value, 10) || 0;
                if (task.startDate) {
                    const start = new Date(task.startDate);
                    start.setDate(start.getDate() + days);
                    task.endDate = start.toISOString().split('T')[0];
                }
            } else {
                (task as any)[field] = value;
            }

            newTasks[index] = task;
            return { ...prev, productionTasks: newTasks };
        });
    };

    const productionTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        (formData.productionTasks || []).forEach(task => {
            const material = materials.find(m => m.id === task.materialId);
            const currency = material?.currency || 'SYP';
            if (!totals[currency]) totals[currency] = 0;
            totals[currency] += task.total;
        });
        return totals;
    }, [formData.productionTasks, materials]);


    const handleAddMaterial = async () => {
        if (!newMaterial.name || newMaterial.price <= 0) {
            setToast({ message: 'يرجى إدخال اسم وسعر صحيح للمادة.', type: 'error' });
            return;
        }
        await api.db.insert('manufacturing_materials', newMaterial);
        await refreshData();
        setNewMaterial({ name: '', price: 0, currency: 'SYP' });
        setToast({ message: 'تم تعريف المادة بنجاح.', type: 'success' });
        setIsMaterialModalOpen(false);
    };
    
    const handleDeleteMaterial = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذه المادة؟')) {
            await api.db.delete('manufacturing_materials', id);
            await refreshData();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.employeeId) {
            setToast({ message: 'الرجاء اختيار موظف.', type: 'error' });
            return;
        }

        await api.db.update('employees', formData.employeeId, { biometricId: biometricIdInput });

        const staffData = {
            employeeId: formData.employeeId,
            flatSalary: formData.flatSalary,
            currency: formData.currency,
            period: formData.period,
            tasks: formData.tasks.filter(t => t.trim() !== ''),
            production_tasks: formData.productionTasks || [] 
        };

        if (selectedStaff) {
            await api.db.update('manufacturing_staff', selectedStaff.id, staffData);
            setToast({ message: 'تم التحديث بنجاح.', type: 'success' });
        } else {
            await api.db.insert('manufacturing_staff', staffData);
            setToast({ message: 'تمت الإضافة بنجاح.', type: 'success' });
        }

        await refreshData();
        setIsModalOpen(false);
    };

    // --- Interaction Logic ---

    // 1. Click on Name -> Open Employee Card
    const handleNameClick = (staff: ManufacturingStaff) => {
        setViewingStaff(staff);
        setIsEmployeeCardOpen(true);
    };

    // 2. Click on Task (inside Employee Card) -> Open Task Details (Smart Card)
    const handleOpenTaskSmartCard = (staff: ManufacturingStaff, task: ProductionTask) => {
        setSelectedTaskStaffId(staff.id);
        setSelectedTask(task);
        setIsTaskDetailModalOpen(true);
    };

    // 3. Save Logic inside Smart Card
    const handleSaveTaskDetails = async () => {
        if (!selectedTask || !selectedTaskStaffId) return;

        const staff = manufacturingStaff.find(s => s.id === selectedTaskStaffId);
        if (!staff) return;

        const currentTasks = (staff as any).production_tasks || staff.productionTasks || [];
        
        const updatedTasks = currentTasks.map((t: ProductionTask) => {
            if (t.id && t.id === selectedTask.id) return selectedTask;
            if (!t.id && t.materialId === selectedTask.materialId) return selectedTask;
            return t;
        });

        await api.db.update('manufacturing_staff', staff.id, { production_tasks: updatedTasks });
        await refreshData();
        
        // Update the local viewing state if open to reflect changes immediately
        if (viewingStaff && viewingStaff.id === staff.id) {
             setViewingStaff({ ...viewingStaff, productionTasks: updatedTasks });
        }

        setToast({ message: 'تم تحديث حالة المهمة.', type: 'success' });
        setIsTaskDetailModalOpen(false);
    };

    const getDaysRemaining = (endDate: string) => {
        const end = new Date(endDate);
        const today = new Date();
        const diffTime = end.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return diffDays;
    };

    const handleExport = () => {
        const data = filteredStaff.map(s => {
            const pTasks = (s as any).production_tasks || s.productionTasks || [];
            const materialNames = pTasks.map((pt: ProductionTask) => {
                const mat = materials.find(m => m.id === pt.materialId);
                return mat ? `${mat.name} (${pt.quantity}) - ${statusTranslations[pt.status] || 'جديد'}` : '';
            }).join(', ');

            return {
                'اسم الموظف': getEmployeeName(s.employeeId),
                'معرف البصمة': getEmployeeBiometric(s.employeeId),
                'الراتب المقطوع': s.flatSalary,
                'العملة': currencyTranslations[s.currency],
                'الفترة': periodTranslations[s.period],
                'ملاحظات': s.tasks.join(', '),
                'مواد منتجة': materialNames
            };
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Manufacturing");
        XLSX.writeFile(wb, "manufacturing_staff.xlsx");
    };

    const handlePrintList = () => {
        const content = `
            <div dir="rtl">
                <h2 style="text-align: center; margin-bottom: 20px;">قائمة موظفين التصنيع</h2>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="border: 1px solid #ddd; padding: 8px;">الاسم</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">البصمة</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">الراتب</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">العملة</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">المواد</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredStaff.map(s => {
                             const pTasks = (s as any).production_tasks || s.productionTasks || [];
                             const tasksStr = pTasks.map((t: any) => {
                                 const m = materials.find(mat => mat.id === t.materialId);
                                 return `${m?.name || 'مادة'} (${t.quantity})`;
                             }).join(', ');
                             
                             return `
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 8px;">${getEmployeeName(s.employeeId)}</td>
                                <td style="border: 1px solid #ddd; padding: 8px;">${getEmployeeBiometric(s.employeeId)}</td>
                                <td style="border: 1px solid #ddd; padding: 8px;">${s.flatSalary}</td>
                                <td style="border: 1px solid #ddd; padding: 8px;">${currencyTranslations[s.currency]}</td>
                                <td style="border: 1px solid #ddd; padding: 8px;">${tasksStr}</td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
        api.app.print({ content });
    };

    return (
        <div className="p-6">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                        {React.cloneElement(ICONS.manufacturing, { className: "h-6 w-6" })}
                    </div>
                    <h2 className="text-2xl font-bold text-neutral">قسم موظفين التصنيع</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setIsMaterialModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2">
                        <span>+</span> تعريف مادة
                    </button>
                    <button onClick={handlePrintList} className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition flex items-center gap-2">
                        {React.cloneElement(ICONS.print, { className: "h-5 w-5" })} طباعة A4
                    </button>
                    <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2">
                        {React.cloneElement(ICONS.export, { className: "h-5 w-5" })} تصدير
                    </button>
                    <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition flex items-center gap-2">
                        <span>+</span> إضافة موظف تصنيع
                    </button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-md mb-6">
                <input
                    type="text"
                    placeholder="بحث باسم الموظف..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                />
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-x-auto">
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6">اسم الموظف</th>
                            <th className="py-3 px-6">معرف البصمة</th>
                            <th className="py-3 px-6">الراتب المقطوع</th>
                            <th className="py-3 px-6">العملة</th>
                            <th className="py-3 px-6">مهام التصنيع (المواد)</th>
                            <th className="py-3 px-6">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredStaff.map(staff => {
                            const pTasks: ProductionTask[] = (staff as any).production_tasks || staff.productionTasks || [];
                            
                            return (
                                <tr key={staff.id}>
                                    <td 
                                        className="py-4 px-6 font-semibold text-primary cursor-pointer hover:underline"
                                        onClick={() => handleNameClick(staff)}
                                        title="اضغط لعرض سجل المهام التفصيلي"
                                    >
                                        {getEmployeeName(staff.employeeId)}
                                    </td>
                                    <td className="py-4 px-6 font-mono text-gray-600">{getEmployeeBiometric(staff.employeeId) || '-'}</td>
                                    <td className="py-4 px-6 font-bold">{staff.flatSalary}</td>
                                    <td className="py-4 px-6">{currencyTranslations[staff.currency]}</td>
                                    <td className="py-4 px-6">
                                        <div className="flex flex-wrap gap-2">
                                            {pTasks.length > 0 ? pTasks.map((task, i) => {
                                                const mat = materials.find(m => m.id === task.materialId);
                                                const statusStyle = statusColors[task.status] || statusColors['Pending'];
                                                return (
                                                    <button 
                                                        key={i} 
                                                        onClick={() => handleOpenTaskSmartCard(staff, task)}
                                                        className={`text-xs font-medium px-2 py-1 rounded-full border transition hover:shadow-md ${statusStyle} flex items-center gap-1`}
                                                    >
                                                        <span>{mat?.name} ({task.quantity})</span>
                                                        {task.status === 'Completed' && <span className="text-green-600">✓</span>}
                                                    </button>
                                                )
                                            }) : <span className="text-gray-400 text-sm">لا يوجد مواد</span>}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 space-x-2 space-x-reverse">
                                        <button onClick={() => handleEdit(staff)} className="text-primary hover:text-primary-dark p-1">{React.cloneElement(ICONS.edit, { className: "h-5 w-5" })}</button>
                                        <button onClick={() => handleDelete(staff.id)} className="text-red-600 hover:text-red-800 p-1">{React.cloneElement(ICONS.delete, { className: "h-5 w-5" })}</button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredStaff.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-gray-500">لا يوجد موظفين في هذا القسم.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal: Employee Production Card (Overview) */}
            {viewingStaff && (
                <Modal 
                    title={`سجل التصنيع: ${getEmployeeName(viewingStaff.employeeId)}`} 
                    isOpen={isEmployeeCardOpen} 
                    onClose={() => setIsEmployeeCardOpen(false)}
                    size="large"
                >
                    <div className="p-4 space-y-6">
                        {/* Header Info */}
                        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border">
                            <div>
                                <p className="text-sm text-gray-500">الراتب المتفق عليه</p>
                                <p className="text-xl font-bold">{viewingStaff.flatSalary} <span className="text-sm font-normal">{currencyTranslations[viewingStaff.currency]}</span></p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">الفترة</p>
                                <p className="font-semibold">{periodTranslations[viewingStaff.period]}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">إجمالي المهام</p>
                                <p className="font-semibold">{((viewingStaff as any).production_tasks || viewingStaff.productionTasks || []).length}</p>
                            </div>
                        </div>

                        {/* Task List Grid */}
                        <div className="space-y-3">
                            <h4 className="font-bold text-gray-700 border-b pb-2">قائمة المهام المسندة</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {((viewingStaff as any).production_tasks || viewingStaff.productionTasks || []).map((task: ProductionTask, idx: number) => {
                                    const material = materials.find(m => m.id === task.materialId);
                                    const daysLeft = getDaysRemaining(task.endDate);
                                    
                                    return (
                                        <div 
                                            key={idx} 
                                            onClick={() => handleOpenTaskSmartCard(viewingStaff, task)}
                                            className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition bg-white relative overflow-hidden group`}
                                        >
                                            <div className={`absolute top-0 right-0 w-2 h-full ${task.status === 'Completed' ? 'bg-green-500' : task.status === 'In Progress' ? 'bg-blue-500' : 'bg-yellow-500'}`}></div>
                                            <div className="mr-3">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h5 className="font-bold text-lg">{material?.name || 'مادة غير معروفة'}</h5>
                                                    <span className={`text-xs px-2 py-1 rounded font-bold ${statusColors[task.status]}`}>
                                                        {statusTranslations[task.status]}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                                                    <p>الكمية: <span className="font-semibold">{task.quantity}</span></p>
                                                    <p>الإجمالي: <span className="font-semibold">{task.total}</span></p>
                                                </div>
                                                <div className="flex justify-between items-center text-xs mt-2 border-t pt-2">
                                                    <span className="text-gray-500">{task.startDate} {'->'} {task.endDate}</span>
                                                    {task.status !== 'Completed' && (
                                                        <span className={`font-bold ${daysLeft < 0 ? 'text-red-600' : daysLeft === 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                                                            {daysLeft < 0 ? `متأخر ${Math.abs(daysLeft)} يوم` : daysLeft === 0 ? 'اليوم!' : `باقي ${daysLeft} يوم`}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="absolute top-1/2 left-2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition text-gray-400">
                                                    {React.cloneElement(ICONS.edit, { className: "h-5 w-5" })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {((viewingStaff as any).production_tasks || viewingStaff.productionTasks || []).length === 0 && (
                                    <p className="col-span-2 text-center text-gray-500 py-4 border border-dashed rounded-lg">لا توجد مهام مسجلة حالياً.</p>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex justify-end border-t pt-4">
                            <button onClick={() => setIsEmployeeCardOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إغلاق</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Modal: Add/Edit Staff (Form) */}
            <Modal title={selectedStaff ? 'تعديل موظف تصنيع' : 'إضافة موظف تصنيع جديد'} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="xl" maximizable>
                <form onSubmit={handleSubmit} className="p-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">اختيار الموظف</label>
                            <select
                                name="employeeId"
                                value={formData.employeeId}
                                onChange={handleFormChange}
                                className="w-full p-2 border rounded-md bg-white disabled:bg-gray-100"
                                required
                                disabled={!!selectedStaff}
                            >
                                <option value={0} disabled>-- اختر --</option>
                                {availableEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">معرف البصمة (Biometric ID)</label>
                            <input
                                type="text"
                                value={biometricIdInput}
                                onChange={(e) => setBiometricIdInput(e.target.value)}
                                className="w-full p-2 border rounded-md ltr"
                                placeholder="مثال: 101"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">الراتب المقطوع</label>
                            <input
                                type="number"
                                name="flatSalary"
                                value={formData.flatSalary}
                                onChange={handleFormChange}
                                className="w-full p-2 border rounded-md"
                                min="0"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">العملة</label>
                            <select name="currency" value={formData.currency} onChange={handleFormChange} className="w-full p-2 border rounded-md bg-white">
                                <option value="SYP">ليرة سوري</option>
                                <option value="USD">دولار أمريكي</option>
                                <option value="TRY">ليرة تركي</option>
                            </select>
                        </div>
                    </div>

                    {/* Production Tasks Section */}
                    <div className="border-t pt-4 mt-2">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-lg font-bold text-neutral">مهام التصنيع (المواد)</label>
                            <button type="button" onClick={addProductionTask} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700">+ إضافة تصنيع</button>
                        </div>
                        
                        {(formData.productionTasks || []).length > 0 ? (
                            <div className="space-y-2 max-h-80 overflow-y-auto bg-gray-50 p-3 rounded-lg border">
                                <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 font-semibold mb-1">
                                    <div className="col-span-3">المادة</div>
                                    <div className="col-span-2">الكمية</div>
                                    <div className="col-span-3">من تاريخ</div>
                                    <div className="col-span-2">مدة (أيام)</div>
                                    <div className="col-span-2"></div>
                                </div>
                                {formData.productionTasks.map((task, index) => {
                                    const material = materials.find(m => m.id === task.materialId);
                                    
                                    return (
                                        <div key={index} className="grid grid-cols-12 gap-2 items-center border-b pb-2 mb-2 last:border-0 last:mb-0 last:pb-0">
                                            <div className="col-span-3">
                                                <select 
                                                    value={task.materialId} 
                                                    onChange={(e) => handleProductionTaskChange(index, 'materialId', Number(e.target.value))}
                                                    className="w-full p-2 border rounded text-sm bg-white"
                                                >
                                                    {materials.map(m => (
                                                        <option key={m.id} value={m.id}>{m.name}</option>
                                                    ))}
                                                </select>
                                                <div className="text-xs text-gray-500 mt-1">الإجمالي: {task.total.toFixed(0)} {material?.currency}</div>
                                            </div>
                                            <div className="col-span-2">
                                                <input 
                                                    type="number" min="1" value={task.quantity} 
                                                    onChange={(e) => handleProductionTaskChange(index, 'quantity', parseFloat(e.target.value))}
                                                    className="w-full p-2 border rounded text-sm" 
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <input 
                                                    type="date" value={task.startDate}
                                                    onChange={(e) => handleProductionTaskChange(index, 'startDate', e.target.value)}
                                                    className="w-full p-2 border rounded text-sm"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <input 
                                                    type="number" placeholder="أيام" 
                                                    onChange={(e) => handleProductionTaskChange(index, 'duration', e.target.value)}
                                                    className="w-full p-2 border rounded text-sm"
                                                />
                                            </div>
                                            <div className="col-span-2 text-center">
                                                <button type="button" onClick={() => removeProductionTask(index)} className="text-red-500 hover:text-red-700 font-bold px-2 py-1 bg-red-50 rounded">حذف</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-4 bg-gray-50 rounded border border-dashed text-gray-500 text-sm">
                                لم يتم إضافة مواد للتصنيع بعد.
                            </div>
                        )}

                        {/* Grand Total Section */}
                        {Object.keys(productionTotals).length > 0 && (
                            <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex justify-between items-center">
                                <span className="font-bold text-indigo-900">المجموع النهائي:</span>
                                <div className="flex gap-4">
                                    {Object.entries(productionTotals).map(([curr, total]) => (
                                        <span key={curr} className="font-mono font-bold text-lg text-indigo-700 bg-white px-3 py-1 rounded border border-indigo-100 shadow-sm">
                                            {total.toFixed(2)} {currencyTranslations[curr as SalaryCurrency] || curr}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">حفظ</button>
                    </div>
                </form>
            </Modal>

            {/* Smart Task Detail Modal */}
            {selectedTask && (
                <Modal 
                    title="تفاصيل المهمة (بطاقة ذكية)" 
                    isOpen={isTaskDetailModalOpen} 
                    onClose={() => setIsTaskDetailModalOpen(false)}
                >
                    <div className="p-4 space-y-6">
                        <div className="flex justify-between items-start bg-gray-50 p-4 rounded-lg border">
                            <div>
                                <h3 className="text-xl font-bold text-neutral">
                                    {materials.find(m => m.id === selectedTask.materialId)?.name || 'مادة غير معروفة'}
                                </h3>
                                <p className="text-sm text-gray-600">الكمية المطلوبة: <span className="font-bold text-lg">{selectedTask.quantity}</span></p>
                            </div>
                            <div className="text-left">
                                <div className={`px-3 py-1 rounded-full text-sm font-bold border ${statusColors[selectedTask.status]}`}>
                                    {statusTranslations[selectedTask.status]}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 border rounded bg-white">
                                <p className="text-xs text-gray-500 mb-1">تاريخ البدء</p>
                                <p className="font-medium">{selectedTask.startDate}</p>
                            </div>
                            <div className="p-3 border rounded bg-white">
                                <p className="text-xs text-gray-500 mb-1">تاريخ الانتهاء المتوقع</p>
                                <p className="font-medium">{selectedTask.endDate}</p>
                            </div>
                        </div>

                        {/* Countdown / Status Logic */}
                        <div className="bg-blue-50 p-4 rounded-lg text-center">
                            {selectedTask.status === 'Completed' ? (
                                <p className="text-green-700 font-bold text-lg">✨ تم إنجاز المهمة</p>
                            ) : (
                                (() => {
                                    const daysLeft = getDaysRemaining(selectedTask.endDate);
                                    if (daysLeft < 0) return <p className="text-red-600 font-bold">⚠️ متأخر بـ {Math.abs(daysLeft)} يوم</p>;
                                    if (daysLeft === 0) return <p className="text-orange-600 font-bold">⚠️ التسليم اليوم!</p>;
                                    return <p className="text-blue-700 font-bold">⏳ متبقي {daysLeft} يوم</p>;
                                })()
                            )}
                        </div>

                        {/* Actions */}
                        <div>
                            <label className="block text-sm font-medium mb-2">تحديث الحالة:</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button 
                                    onClick={() => setSelectedTask({...selectedTask, status: 'Pending'})}
                                    className={`py-2 rounded border ${selectedTask.status === 'Pending' ? 'bg-yellow-500 text-white border-yellow-600' : 'bg-white hover:bg-gray-50'}`}
                                >
                                    قيد الانتظار
                                </button>
                                <button 
                                    onClick={() => setSelectedTask({...selectedTask, status: 'In Progress'})}
                                    className={`py-2 rounded border ${selectedTask.status === 'In Progress' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white hover:bg-gray-50'}`}
                                >
                                    جاري العمل
                                </button>
                                <button 
                                    onClick={() => setSelectedTask({...selectedTask, status: 'Completed'})}
                                    className={`py-2 rounded border ${selectedTask.status === 'Completed' ? 'bg-green-600 text-white border-green-700' : 'bg-white hover:bg-gray-50'}`}
                                >
                                    تم الإنجاز
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">ملاحظات الإنجاز:</label>
                            <textarea 
                                value={selectedTask.notes || ''}
                                onChange={(e) => setSelectedTask({...selectedTask, notes: e.target.value})}
                                className="w-full p-2 border rounded-md"
                                rows={2}
                                placeholder="اكتب أي ملاحظات حول التقدم..."
                            ></textarea>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button onClick={() => setIsTaskDetailModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-lg">إغلاق</button>
                            <button onClick={handleSaveTaskDetails} className="px-4 py-2 bg-primary text-white rounded-lg">حفظ التغييرات</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Modal: Define Materials */}
            <Modal title="تعريف المواد الأولية" isOpen={isMaterialModalOpen} onClose={() => setIsMaterialModalOpen(false)}>
                <div className="p-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input 
                            placeholder="اسم المادة" 
                            value={newMaterial.name} 
                            onChange={e => setNewMaterial(prev => ({...prev, name: e.target.value}))}
                            className="p-2 border rounded"
                        />
                        <input 
                            type="number" 
                            placeholder="سعر الوحدة" 
                            value={newMaterial.price || ''} 
                            onChange={e => setNewMaterial(prev => ({...prev, price: parseFloat(e.target.value)}))}
                            className="p-2 border rounded"
                        />
                        <select 
                            value={newMaterial.currency} 
                            onChange={e => setNewMaterial(prev => ({...prev, currency: e.target.value as SalaryCurrency}))}
                            className="p-2 border rounded bg-white"
                        >
                            <option value="SYP">ليرة سوري</option>
                            <option value="USD">دولار أمريكي</option>
                            <option value="TRY">ليرة تركي</option>
                        </select>
                    </div>
                    <button onClick={handleAddMaterial} className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">حفظ المادة</button>
                    
                    <div className="border-t pt-4 mt-4">
                        <h4 className="font-bold mb-2">المواد المعرفة مسبقاً</h4>
                        <ul className="max-h-60 overflow-y-auto space-y-2">
                            {materials.map(m => (
                                <li key={m.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border">
                                    <span>{m.name}</span>
                                    <span className="font-mono text-sm bg-white px-2 py-1 rounded border">{m.price} {currencyTranslations[m.currency]}</span>
                                    <button onClick={() => handleDeleteMaterial(m.id)} className="text-red-500 hover:text-red-700 p-1">{React.cloneElement(ICONS.delete, {className: "h-4 w-4"})}</button>
                                </li>
                            ))}
                            {materials.length === 0 && <p className="text-center text-gray-500 text-sm">لا توجد مواد.</p>}
                        </ul>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Manufacturing;
