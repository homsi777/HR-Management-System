import React, { useState, useMemo } from 'react';
import { UnmatchedAttendanceRecord, Employee, IElectronAPI, ToastState } from '../types';
import { ICONS } from '../constants';

interface ResolveAttendanceProps {
    unmatchedAttendance: UnmatchedAttendanceRecord[];
    employees: Employee[];
    api: IElectronAPI;
    refreshData: () => Promise<void>;
    setToast: (toast: ToastState) => void;
    onClose: () => void;
}

const ResolveAttendance: React.FC<ResolveAttendanceProps> = ({ unmatchedAttendance, employees, api, refreshData, setToast, onClose }) => {
    const [assignments, setAssignments] = useState<Record<number, number | ''>>({});

    const unassignedEmployees = useMemo(() => {
        return employees.filter(e => !e.biometricId && e.status === 'active');
    }, [employees]);

    const handleAssignmentChange = (unmatchedId: number, employeeId: string) => {
        setAssignments(prev => ({ ...prev, [unmatchedId]: employeeId ? Number(employeeId) : '' }));
    };

    const handleAssign = async (unmatchedId: number) => {
        const employeeId = assignments[unmatchedId];
        if (!employeeId) {
            setToast({ message: 'يرجى اختيار موظف لربط السجل به.', type: 'error' });
            return;
        }
        
        const result = await api.app.resolveUnmatchedRecord({ unmatchedId, employeeId: Number(employeeId) });
        setToast({ message: result.message, type: result.success ? 'success' : 'error' });

        if (result.success) {
            await refreshData();
            // Check if this was the last record
            if (unmatchedAttendance.length <= 1) {
                onClose();
            }
        }
    };

    const handleDiscard = async (unmatchedId: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذا السجل غير المطابق؟ لا يمكن التراجع عن هذا الإجراء.')) {
            await api.db.delete('unmatched_attendance', unmatchedId);
            setToast({ message: 'تم حذف السجل بنجاح.', type: 'success' });
            await refreshData();
            if (unmatchedAttendance.length <= 1) {
                onClose();
            }
        }
    };

    if (unmatchedAttendance.length === 0) {
        return (
            <div className="p-6 text-center text-gray-500">
                <p>رائع! لا توجد سجلات حضور غير مطابقة حالياً.</p>
                <button onClick={onClose} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">إغلاق</button>
            </div>
        );
    }

    return (
        <div className="p-2">
            <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 mb-4 text-sm">
                <p>ظهرت هذه السجلات لأن النظام استقبل بصمات من أجهزة حضور لموظفين غير مسجلين أو غير مربوطين برقم بصمة. قم بربط كل سجل بالموظف الصحيح.</p>
            </div>
            <div className="max-h-[55vh] overflow-y-auto pr-2">
                <ul className="space-y-4">
                    {unmatchedAttendance.map(record => (
                        <li key={record.id} className="bg-white p-4 rounded-lg border">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                <div className="mb-4 md:mb-0">
                                    <p className="font-bold text-neutral">
                                        معرّف البصمة: <span className="font-mono bg-gray-100 p-1 rounded">{record.biometricId}</span>
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        تاريخ: {record.date} | 
                                        البصمات المسجلة: <span className="font-mono">{JSON.parse(record.punches).join(', ')}</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select 
                                        value={assignments[record.id] || ''}
                                        onChange={(e) => handleAssignmentChange(record.id, e.target.value)}
                                        className="p-2 border rounded-lg bg-white w-full md:w-48"
                                    >
                                        <option value="">-- ربط بالموظف --</option>
                                        {unassignedEmployees.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                                        ))}
                                        {unassignedEmployees.length === 0 && <option disabled>لا يوجد موظفين متاحين</option>}
                                    </select>
                                    <button
                                        onClick={() => handleAssign(record.id)}
                                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:bg-gray-400"
                                        disabled={!assignments[record.id]}
                                    >
                                        ربط
                                    </button>
                                    <button 
                                        onClick={() => handleDiscard(record.id)}
                                        className="p-2 text-red-600 hover:bg-red-100 rounded-full"
                                        title="تجاهل وحذف السجل"
                                    >
                                        {React.cloneElement(ICONS.delete, { className: "h-5 w-5" })}
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
             <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إغلاق</button>
            </div>
        </div>
    );
};

export default ResolveAttendance;
