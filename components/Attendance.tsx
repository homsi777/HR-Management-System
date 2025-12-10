import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { AttendanceRecord, Employee, IElectronAPI } from '../types';
import Modal from './ui/Modal';
import { ICONS } from '../constants';

type SortableKeys = 'employeeName' | 'date' | 'checkIn' | 'checkOut';

interface AttendanceProps {
  attendance: AttendanceRecord[];
  employees: Employee[];
  refreshData: () => Promise<void>;
  api: IElectronAPI;
}

const Attendance: React.FC<AttendanceProps> = ({ attendance, employees, refreshData, api }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    // FIX: Used Omit to ensure employeeId can be string or number in the state, overriding the strict number type from AttendanceRecord.
    const [selectedRecord, setSelectedRecord] = useState<Partial<Omit<AttendanceRecord, 'employeeId'> & { startDate?: string; endDate?: string; employeeId?: number | string }>>({});
    const [isProcessing, setIsProcessing] = useState(false);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterEmployeeId, setFilterEmployeeId] = useState<number | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({ key: 'date', direction: 'descending' });
    
    // Set initial date range to cover all available data, preventing new records from being hidden
    useEffect(() => {
        if (attendance.length > 0) {
            // Use string comparison for YYYY-MM-DD format, which is safe and efficient.
            let minDateStr = attendance[0].date;
            let maxDateStr = attendance[0].date;
            for (const record of attendance) {
                if (record.date < minDateStr) minDateStr = record.date;
                if (record.date > maxDateStr) maxDateStr = record.date;
            }
            setStartDate(minDateStr);
            setEndDate(maxDateStr);
        } else {
            // Default to last 7 days if there is no data at all
            const today = new Date();
            const weekAgo = new Date();
            weekAgo.setDate(today.getDate() - 7);
            setStartDate(weekAgo.toISOString().split('T')[0]);
            setEndDate(today.toISOString().split('T')[0]);
        }
    }, [attendance]);

    const getEmployeeName = (employeeId: number) => employees.find(e => e.id === employeeId)?.name || 'Unknown';

    const filteredAndSortedAttendance = useMemo(() => {
        if (!startDate || !endDate) return []; // Guard against initial render before useEffect sets dates

        let filtered = attendance.filter(record => 
            (record.date >= startDate && record.date <= endDate) &&
            (filterEmployeeId === 'all' || record.employeeId === filterEmployeeId) &&
            (searchTerm === '' || getEmployeeName(record.employeeId).toLowerCase().includes(searchTerm.toLowerCase()))
        );

        if (sortConfig) {
            filtered.sort((a, b) => {
                let aValue: any, bValue: any;
                if (sortConfig.key === 'employeeName') {
                    aValue = getEmployeeName(a.employeeId); bValue = getEmployeeName(b.employeeId);
                } else {
                    aValue = a[sortConfig.key as keyof AttendanceRecord]; bValue = b[sortConfig.key as keyof AttendanceRecord];
                }
                if (aValue === null) return 1; if (bValue === null) return -1;
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [attendance, startDate, endDate, filterEmployeeId, sortConfig, employees, searchTerm]);

    const requestSort = (key: SortableKeys) => {
        setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending' }));
    };

    const getSortIndicator = (key: SortableKeys) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    const handleModalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
    
        setSelectedRecord(prev => {
            const updatedRecord = { ...prev, [name]: value };
    
            if (name === 'employeeId') {
                const employee = employees.find(emp => emp.id === Number(value));
                if (employee) {
                    updatedRecord.checkIn = employee.checkInStartTime || '08:00';
                    updatedRecord.checkOut = employee.checkOutStartTime || '17:00';
                }
            }
            return updatedRecord;
        });
    };
    
    const handleAdd = () => {
        const today = new Date().toISOString().split('T')[0];
        const firstActiveEmployee = employees.find(e => e.status === 'active');
        setSelectedRecord({ 
            startDate: today, 
            endDate: today, 
            employeeId: firstActiveEmployee?.id || '',
            checkIn: firstActiveEmployee?.checkInStartTime || '08:00',
            checkOut: firstActiveEmployee?.checkOutStartTime || '17:00'
        });
        setIsModalOpen(true);
    };

    const handleEdit = (record: AttendanceRecord) => {
        setSelectedRecord(record);
        setIsModalOpen(true);
    };

    const handleDelete = async (recordId: number) => {
        await api.db.delete('attendance', recordId);
        await refreshData();
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        const data = selectedRecord;

        try {
            if (data?.id) { // Editing existing record
                const recordData = {
                    // FIX: Safely convert employeeId to a number. It can be a string from the form's select input.
                    employeeId: Number(data.employeeId || 0),
                    date: data.date as string,
                    checkIn: data.checkIn as string,
                    checkOut: (data.checkOut as string) || null,
                };
                await api.db.update('attendance', data.id, recordData);
            } else { // Adding new records for a date range
                const { employeeId, startDate, endDate, checkIn, checkOut } = data;
                if (!employeeId || !startDate || !endDate || !checkIn) {
                    throw new Error("يرجى ملء جميع الحقول المطلوبة.");
                }
                const employee = employees.find(emp => emp.id === Number(employeeId));
                if (!employee) {
                     throw new Error("لم يتم العثور على الموظف المحدد.");
                }
                const employeeWorkdays = new Set(employee.workdays);

                let currentDate = new Date(startDate as string);
                const lastDate = new Date(endDate as string);
                let recordsAdded = 0;
                
                if (currentDate > lastDate) {
                    throw new Error("تاريخ البدء يجب أن يكون قبل تاريخ الانتهاء.");
                }

                while (currentDate <= lastDate) {
                    if (employeeWorkdays.has(currentDate.getDay())) {
                        const recordData = {
                            employeeId: Number(employeeId),
                            date: currentDate.toISOString().split('T')[0],
                            checkIn: checkIn as string,
                            checkOut: (checkOut as string) || null,
                            source: 'manual' as const,
                        };
                        await api.db.insert('attendance', recordData);
                        recordsAdded++;
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                if (recordsAdded === 0) {
                     alert("لم يتم العثور على أيام عمل ضمن النطاق المحدد للموظف.");
                }
            }
            await refreshData();
            setIsModalOpen(false);
        } catch (error: any) {
            alert(`حدث خطأ: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExport = () => {
        const dataToExport = filteredAndSortedAttendance.map(rec => ({
            'الموظف': getEmployeeName(rec.employeeId), 'التاريخ': rec.date,
            'وقت الحضور': rec.checkIn, 'وقت الانصراف': rec.checkOut || 'لم يسجل',
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Attendance`);
        XLSX.writeFile(wb, `attendance_report.xlsx`);
    };

    const handlePrint = () => {
        if (window.electronAPI) {
            api.app.print({});
        } else {
            window.print();
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6 no-print">
                 <h2 className="text-2xl font-bold text-neutral">سجل الحضور</h2>
                 <div className="flex items-center gap-2">
                    <button onClick={handleExport} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2">{ICONS.export} تصدير</button>
                    <button onClick={handlePrint} className="bg-gray-600 text-white p-2 rounded-lg hover:bg-gray-700 transition flex items-center gap-2">{ICONS.print} طباعة</button>
                    <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition">إضافة سجل يدوي</button>
                 </div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-md mb-6 flex items-center flex-wrap gap-4 no-print">
                <label>من:</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-2 border rounded-lg bg-white"/>
                <label>إلى:</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-2 border rounded-lg bg-white"/>
                <select value={filterEmployeeId} onChange={(e) => setFilterEmployeeId(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="p-2 border rounded-lg bg-white w-full sm:w-auto md:w-1/4">
                    <option value="all">كل الموظفين</option>
                    {employees.filter(emp => emp.status === 'active').map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
                <input
                    type="text"
                    placeholder="بحث باسم الموظف..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="p-2 border rounded-lg bg-white flex-grow"
                />
            </div>
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                 <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6"><button onClick={() => requestSort('employeeName')} className="font-medium">الموظف{getSortIndicator('employeeName')}</button></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('date')} className="font-medium">التاريخ{getSortIndicator('date')}</button></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('checkIn')} className="font-medium">وقت الحضور{getSortIndicator('checkIn')}</button></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('checkOut')} className="font-medium">وقت الانصراف{getSortIndicator('checkOut')}</button></th>
                            <th className="py-3 px-6 no-print">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredAndSortedAttendance.map(record => (
                            <tr key={record.id}>
                                <td className="py-4 px-6">{getEmployeeName(record.employeeId)}</td>
                                <td className="py-4 px-6">{record.date}</td>
                                <td className="py-4 px-6">{record.checkIn}</td>
                                <td className="py-4 px-6">{record.checkOut ? record.checkOut : 'لم يسجل'}</td>
                                <td className="py-4 px-6 space-x-2 space-x-reverse no-print">
                                    <button onClick={() => handleEdit(record)} className="text-primary hover:text-primary-dark p-1">{React.cloneElement(ICONS.edit, {className: "h-5 w-5"})}</button>
                                    <button onClick={() => handleDelete(record.id)} className="text-red-600 hover:text-red-800 p-1">{React.cloneElement(ICONS.delete, {className: "h-5 w-5"})}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             <Modal title={selectedRecord?.id ? "تعديل سجل الحضور" : "إضافة سجلات حضور يدوية"} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <select name="employeeId" value={selectedRecord?.employeeId || ''} onChange={handleModalChange} className="w-full p-2 border rounded bg-white" required>
                        <option value="">اختر الموظف</option>
                        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                    {selectedRecord?.id ? (
                        <input name="date" type="date" value={selectedRecord?.date || ''} onChange={handleModalChange} className="w-full p-2 border rounded" required />
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm">من تاريخ</label>
                                <input name="startDate" type="date" value={selectedRecord?.startDate || ''} onChange={handleModalChange} className="w-full p-2 border rounded" required />
                            </div>
                            <div>
                                <label className="block text-sm">إلى تاريخ</label>
                                <input name="endDate" type="date" value={selectedRecord?.endDate || ''} onChange={handleModalChange} className="w-full p-2 border rounded" required />
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm">وقت الحضور</label>
                            <input name="checkIn" type="time" value={selectedRecord?.checkIn || ''} onChange={handleModalChange} className="w-full p-2 border rounded" required />
                        </div>
                        <div>
                            <label className="block text-sm">وقت الانصراف</label>
                            <input name="checkOut" type="time" value={selectedRecord?.checkOut || ''} onChange={handleModalChange} className="w-full p-2 border rounded" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark" disabled={isProcessing}>
                            {isProcessing ? 'جاري الحفظ...' : 'حفظ'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Attendance;