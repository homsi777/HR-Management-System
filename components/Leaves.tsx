
import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { LeaveRequest, Employee, LeaveType, LeaveStatus, IElectronAPI, JobTitle, PrintSettings, LeaveWorkPayment } from '../types';
import Modal from './ui/Modal';
import { ICONS } from '../constants';

type SortableKeys = 'employeeName' | 'type' | 'startDate' | 'status';

const leaveTypeTranslations: Record<LeaveType, string> = { 'Annual': 'سنوية', 'Sick': 'مرضية', 'Emergency': 'طارئة', 'Unpaid': 'بدون راتب' };
const leaveStatusTranslations: Record<LeaveStatus, string> = { 'Approved': 'موافق عليه', 'Pending': 'قيد الانتظار', 'Rejected': 'مرفوض' };

interface LeavesProps {
    leaveRequests: LeaveRequest[];
    employees: Employee[];
    jobTitles: JobTitle[];
    printSettings: PrintSettings | null;
    leaveWorkPayments: LeaveWorkPayment[];
    refreshData: () => Promise<void>;
    api: IElectronAPI;
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
}

const Leaves: React.FC<LeavesProps> = ({ leaveRequests, employees, jobTitles, refreshData, api, printSettings, leaveWorkPayments, setToast }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
    const [formData, setFormData] = useState<Omit<LeaveRequest, 'id' | 'status'>>({ employeeId: 0, startDate: '', endDate: '', reason: '', type: 'Annual', deductFromSalary: false });
    const [filterStatus, setFilterStatus] = useState<'all' | LeaveRequest['status']>('all');
    const [filterEmployeeId, setFilterEmployeeId] = useState<number | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({ key: 'startDate', direction: 'descending' });
    
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [statusChangeData, setStatusChangeData] = useState<{ request: LeaveRequest, newStatus: LeaveStatus } | null>(null);
    const [statusReason, setStatusReason] = useState('');
    const [receiptData, setReceiptData] = useState<any | null>(null);

    const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
    const [isWorkModalOpen, setIsWorkModalOpen] = useState(false);
    const [selectedLeaveForWork, setSelectedLeaveForWork] = useState<LeaveRequest | null>(null);
    const [workReceiptData, setWorkReceiptData] = useState<any | null>(null);

    useEffect(() => {
        const printContent = async (selector: string) => {
            const receiptContent = document.querySelector(selector);
            if (receiptContent) {
                try {
                    await api.app.print({ content: receiptContent.innerHTML });
                } catch (err) {
                    console.error("Print failed:", err);
                }
            } else {
                setToast({ message: 'لم يتم العثور على محتوى الإيصال.', type: 'error' });
            }
        };

        if (receiptData) {
            const timer = setTimeout(() => {
                printContent('.printable-leave-receipt').finally(() => setReceiptData(null));
            }, 100);
            return () => clearTimeout(timer);
        }
        if (workReceiptData) {
            const timer = setTimeout(() => {
                printContent('.printable-receipt').finally(() => setWorkReceiptData(null));
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [receiptData, workReceiptData, api.app, setToast]);


    const getEmployeeName = (employeeId: number) => employees.find(e => e.id === employeeId)?.name || 'Unknown';
    const getJobTitleName = (employeeId: number) => {
        const emp = employees.find(e => e.id === employeeId);
        return emp ? (jobTitles.find(j => j.id === emp.jobTitleId)?.name || 'N/A') : 'N/A';
    };
    
    const filteredAndSortedLeaves = useMemo(() => {
        let filtered = leaveRequests.filter(req => 
            (filterStatus === 'all' || req.status === filterStatus) &&
            (filterEmployeeId === 'all' || req.employeeId === filterEmployeeId) &&
            (searchTerm === '' || getEmployeeName(req.employeeId).toLowerCase().includes(searchTerm.toLowerCase()))
        );
        if (sortConfig) {
            filtered.sort((a, b) => {
                let aValue: any, bValue: any;
                if (sortConfig.key === 'employeeName') {
                    aValue = getEmployeeName(a.employeeId);
                    bValue = getEmployeeName(b.employeeId);
                } else {
                    aValue = a[sortConfig.key];
                    bValue = b[sortConfig.key];
                }
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [leaveRequests, filterStatus, filterEmployeeId, sortConfig, employees, searchTerm]);

    const requestSort = (key: SortableKeys) => {
        setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending' }));
    };

    const getSortIndicator = (key: SortableKeys) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    const openStatusModal = (request: LeaveRequest, newStatus: LeaveStatus) => {
        setStatusChangeData({ request, newStatus });
        setStatusReason(request.statusReason || '');
        setIsStatusModalOpen(true);
    };

    const handleConfirmStatusChange = async () => {
        if (!statusChangeData) return;
        const { request, newStatus } = statusChangeData;
        
        const result = await api.leave.updateStatus({
            requestId: request.id,
            newStatus: newStatus,
            reason: statusReason,
        });

        if (result.success) {
            await refreshData();
        }

        setIsStatusModalOpen(false);
        setStatusChangeData(null);
        setStatusReason('');
    };
    
    const handleAdd = () => {
        setSelectedRequest(null);
        setFormData({ employeeId: employees[0]?.id || 0, startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], reason: '', type: 'Annual', deductFromSalary: false });
        setIsModalOpen(true);
    };

    const handleEdit = (request: LeaveRequest) => {
        setSelectedRequest(request);
        setFormData({
            employeeId: request.employeeId,
            startDate: request.startDate,
            endDate: request.endDate,
            reason: request.reason,
            type: request.type,
            deductFromSalary: request.deductFromSalary || false,
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if(window.confirm('هل أنت متأكد من حذف هذا الطلب؟')) {
            await api.db.delete('leaveRequests', id);
            await refreshData();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({...prev, [name]: name === 'employeeId' ? Number(value) : value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.employeeId || !formData.startDate || !formData.endDate) {
             alert('يرجى ملء جميع الحقول المطلوبة.');
             return;
        }
        if (new Date(formData.startDate) > new Date(formData.endDate)) {
            alert('تاريخ البدء لا يمكن أن يكون بعد تاريخ الانتهاء.');
            return;
        }

        if (selectedRequest) {
            await api.db.update('leaveRequests', selectedRequest.id, formData);
        } else {
            await api.db.insert('leaveRequests', { ...formData, status: 'Pending' });
        }
        await refreshData();
        setIsModalOpen(false);
    };

    const handleExport = () => {
        const dataToExport = filteredAndSortedLeaves.map(req => ({
            'الموظف': getEmployeeName(req.employeeId),
            'نوع الإجازة': leaveTypeTranslations[req.type],
            'تاريخ البدء': req.startDate,
            'تاريخ الانتهاء': req.endDate,
            'السبب': req.reason,
            'الحالة': leaveStatusTranslations[req.status],
            'ملاحظات': req.statusReason || ''
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Leaves Report");
        XLSX.writeFile(wb, "leaves_report.xlsx");
    };
    
    const handlePrint = () => {
        if (window.electronAPI) {
            api.app.print({});
        } else {
            window.print();
        }
    };

    const imageUrlToBase64 = async (url: string): Promise<string> => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Error converting image to Base64:", error);
            return "";
        }
    };

    const handlePrintLeave = async (request: LeaveRequest) => {
        const employee = employees.find(e => e.id === request.employeeId);
        
        let logoBase64 = '';
        if (printSettings?.companyLogo) {
            logoBase64 = printSettings.companyLogo;
        } else {
            logoBase64 = await imageUrlToBase64('../img/logo.png');
        }

        const data = {
            logoBase64,
            companyName: printSettings?.companyName || "اسم الشركة",
            address: printSettings?.address || "",
            phone: printSettings?.phone || "",
            receiptTitle: `${printSettings?.receiptTitle || 'إيصال'} طلب إجازة`,
            template: printSettings?.template || 'template1',
            employeeName: employee?.name || 'N/A',
            jobTitleName: getJobTitleName(request.employeeId),
            requestDate: new Date().toLocaleDateString('ar-EG'),
            startDate: request.startDate,
            endDate: request.endDate,
            leaveType: leaveTypeTranslations[request.type],
            reason: request.reason,
            status: leaveStatusTranslations[request.status],
            statusReason: request.statusReason || 'لا يوجد'
        };

        setReceiptData(data);
    };

    const handleToggleExpand = (requestId: number) => {
        setExpandedRowId(prev => (prev === requestId ? null : requestId));
    };

    const handleOpenWorkModal = (request: LeaveRequest) => {
        setSelectedLeaveForWork(request);
        setIsWorkModalOpen(true);
    };

    const handlePayWorkSession = async (payment: LeaveWorkPayment) => {
        if (window.confirm(`هل أنت متأكد من تسليم مبلغ ${payment.totalAmount.toFixed(2)} ${payment.currency}؟`)) {
            await api.db.update('leave_work_payments', payment.id, {
                status: 'Paid',
                paymentDate: new Date().toISOString()
            });
            await refreshData();
            setToast({ message: 'تم تسجيل عملية الدفع بنجاح.', type: 'success' });
            handlePrintWorkPayment(payment);
        }
    };

    const handlePrintWorkPayment = async (payment: LeaveWorkPayment) => {
        const employee = employees.find(e => e.id === payment.employeeId);
        if (!employee) return;

        let logoBase64 = '';
        if (printSettings?.companyLogo) {
            logoBase64 = printSettings.companyLogo;
        } else {
            logoBase64 = await imageUrlToBase64('../img/logo.png');
        }

        const data = {
            logoBase64,
            companyName: printSettings?.companyName || "اسم الشركة",
            receiptTitle: 'إيصال عمل أثناء إجازة',
            template: printSettings?.template || 'template1',
            employeeName: employee.name,
            date: payment.workDate,
            amount: payment.totalAmount,
            reason: `عمل لمدة ${payment.durationHours.toFixed(2)} ساعة أثناء الإجازة.`,
            currency: payment.currency,
        };
        setWorkReceiptData(data);
    };
    
    return (
        <div className={`p-6 ${receiptData || workReceiptData ? 'is-printing' : ''}`}>
            <div className="flex justify-between items-center mb-6 no-print">
                <h2 className="text-2xl font-bold text-neutral">طلبات الإجازة</h2>
                <div className="flex items-center gap-2">
                    <button onClick={handleExport} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2">{ICONS.export} تصدير</button>
                    <button onClick={handlePrint} className="bg-gray-600 text-white p-2 rounded-lg hover:bg-gray-700 transition flex items-center gap-2">{ICONS.print} طباعة</button>
                    <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition">طلب إجازة جديد</button>
                </div>
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow-md mb-6 flex flex-wrap items-center gap-4 no-print">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="p-2 border rounded-lg bg-white">
                    <option value="all">كل الحالات</option>
                    <option value="Pending">قيد الانتظار</option>
                    <option value="Approved">موافق عليه</option>
                    <option value="Rejected">مرفوض</option>
                </select>
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
                            <th className="py-3 px-2 w-12 no-print"></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('employeeName')} className="font-medium">الموظف{getSortIndicator('employeeName')}</button></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('type')} className="font-medium">نوع الإجازة{getSortIndicator('type')}</button></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('startDate')} className="font-medium">الفترة{getSortIndicator('startDate')}</button></th>
                            <th className="py-3 px-6">السبب والملاحظات</th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('status')} className="font-medium">الحالة{getSortIndicator('status')}</button></th>
                            <th className="py-3 px-6 no-print">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredAndSortedLeaves.map(request => (
                            <React.Fragment key={request.id}>
                            <tr className={expandedRowId === request.id ? 'bg-blue-50' : ''}>
                                <td className="py-4 px-2 text-center no-print">
                                    {request.status === 'Approved' && (
                                    <button onClick={() => handleToggleExpand(request.id)} className="p-1 rounded-full hover:bg-gray-200">
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${expandedRowId === request.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                    )}
                                </td>
                                <td className="py-4 px-6">{getEmployeeName(request.employeeId)}</td>
                                <td className="py-4 px-6">
                                    {leaveTypeTranslations[request.type]}
                                    {request.deductFromSalary && <span className="block text-xs text-red-600 font-semibold">(يُخصم من الراتب)</span>}
                                </td>
                                <td className="py-4 px-6">{request.startDate} إلى {request.endDate}</td>
                                <td className="py-4 px-6 truncate max-w-xs">
                                    {request.reason}
                                    {request.statusReason && <p className="text-xs text-blue-600 mt-1">ملاحظة: {request.statusReason}</p>}
                                </td>
                                <td className="py-4 px-6">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ request.status === 'Approved' ? 'bg-green-100 text-green-800' : request.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800' }`}>
                                        {leaveStatusTranslations[request.status]}
                                    </span>
                                </td>
                                <td className="py-4 px-6 no-print space-x-2 space-x-reverse whitespace-nowrap">
                                    {request.status === 'Pending' && (
                                        <>
                                            <button onClick={() => openStatusModal(request, 'Approved')} className="text-green-600 hover:text-green-800 font-medium">قبول</button>
                                            <button onClick={() => openStatusModal(request, 'Rejected')} className="text-orange-600 hover:text-orange-800 font-medium">رفض</button>
                                        </>
                                    )}
                                     <button onClick={() => handleEdit(request)} className="text-primary hover:text-primary-dark p-1" title="تعديل الطلب">{React.cloneElement(ICONS.edit, {className: "h-5 w-5"})}</button>
                                     <button onClick={() => handlePrintLeave(request)} className="bg-gray-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-gray-600">طباعة</button>
                                     <button onClick={() => handleDelete(request.id)} className="text-red-600 hover:text-red-800 p-1">{React.cloneElement(ICONS.delete, {className: "h-5 w-5"})}</button>
                                </td>
                            </tr>
                             {expandedRowId === request.id && (
                                <tr>
                                    <td colSpan={7} className="p-4 bg-gray-50 border-t-2 border-blue-200">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-semibold text-neutral">العمل المسجل أثناء الإجازة</h4>
                                            <button onClick={() => handleOpenWorkModal(request)} className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700">إضافة جلسة عمل</button>
                                        </div>
                                        <WorkDuringLeaveDetails payments={leaveWorkPayments.filter(p => p.leaveRequestId === request.id)} onPay={handlePayWorkSession} />
                                    </td>
                                </tr>
                            )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <Modal title={selectedRequest ? "تعديل طلب إجازة" : "طلب إجازة جديد"} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <form onSubmit={handleSubmit} className="space-y-4 p-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">الموظف</label>
                        <select name="employeeId" value={formData.employeeId} onChange={handleChange} className="w-full p-2 border rounded-md bg-white" required>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">نوع الإجازة</label>
                         <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2 border rounded-md bg-white" required>
                            {Object.entries(leaveTypeTranslations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                         </select>
                    </div>
                     <div className="pt-2">
                        <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                            <input
                                type="checkbox"
                                name="deductFromSalary"
                                checked={!!(formData as any).deductFromSalary}
                                onChange={handleChange}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm font-medium text-gray-700">خصم هذه الإجازة من الراتب (بغض النظر عن نوعها)</span>
                        </label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ البدء</label>
                            <input name="startDate" type="date" value={formData.startDate} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الانتهاء</label>
                            <input name="endDate" type="date" value={formData.endDate} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">السبب</label>
                        <textarea name="reason" value={formData.reason} onChange={handleChange} rows={3} className="w-full p-2 border rounded-md"></textarea>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">{selectedRequest ? 'حفظ التعديلات' : 'إرسال الطلب'}</button>
                    </div>
                </form>
            </Modal>
            
            <Modal title="تغيير حالة طلب الإجازة" isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)}>
                <div className="p-2 space-y-4">
                    <p>هل أنت متأكد من {statusChangeData?.newStatus === 'Approved' ? 'الموافقة على' : 'رفض'} طلب الإجازة للموظف <strong>{getEmployeeName(statusChangeData?.request.employeeId || 0)}</strong>؟</p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">إضافة ملاحظة (اختياري)</label>
                        <textarea value={statusReason} onChange={(e) => setStatusReason(e.target.value)} rows={3} className="w-full p-2 border rounded-md" placeholder="مثال: تمت الموافقة، لا يوجد رصيد كاف..."></textarea>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={() => setIsStatusModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button onClick={handleConfirmStatusChange} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">تأكيد</button>
                    </div>
                </div>
            </Modal>

            {selectedLeaveForWork && (
                <WorkDuringLeaveModal 
                    isOpen={isWorkModalOpen}
                    onClose={() => setIsWorkModalOpen(false)}
                    leaveRequest={selectedLeaveForWork}
                    employee={employees.find(e => e.id === selectedLeaveForWork.employeeId)!}
                    api={api}
                    setToast={setToast}
                    refreshData={refreshData}
                />
            )}

            {receiptData && <LeaveReceipt data={receiptData} />}
            {workReceiptData && <WorkPaymentReceipt data={workReceiptData} />}
        </div>
    );
};

const WorkDuringLeaveDetails: React.FC<{ payments: LeaveWorkPayment[], onPay: (payment: LeaveWorkPayment) => void }> = ({ payments, onPay }) => {
    if (payments.length === 0) {
        return <p className="text-center text-gray-500 py-4">لا يوجد عمل مسجل خلال هذه الإجازة.</p>;
    }
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className="bg-gray-200">
                    <tr>
                        <th className="p-2">التاريخ</th>
                        <th className="p-2">المدة (ساعة)</th>
                        <th className="p-2">أجر الساعة</th>
                        <th className="p-2">الإجمالي</th>
                        <th className="p-2">الحالة</th>
                        <th className="p-2">الإجراء</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {payments.map(p => (
                        <tr key={p.id}>
                            <td className="p-2">{p.workDate}</td>
                            <td className="p-2">{p.durationHours.toFixed(2)}</td>
                            <td className="p-2">{`${p.rate.toFixed(2)} ${p.currency}`}</td>
                            <td className="p-2 font-semibold">{`${p.totalAmount.toFixed(2)} ${p.currency}`}</td>
                            <td className="p-2">
                                <span className={`px-2 py-1 text-xs rounded-full ${p.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.status === 'Paid' ? 'مدفوع' : 'غير مدفوع'}</span>
                            </td>
                            <td className="p-2">
                                {p.status === 'Unpaid' && <button onClick={() => onPay(p)} className="bg-green-600 text-white px-3 py-1 text-xs rounded hover:bg-green-700">دفع وتسليم</button>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const WorkDuringLeaveModal: React.FC<{ isOpen: boolean, onClose: () => void, leaveRequest: LeaveRequest, employee: Employee, api: IElectronAPI, setToast: LeavesProps['setToast'], refreshData: () => Promise<void> }> = ({ isOpen, onClose, leaveRequest, employee, api, setToast, refreshData }) => {
    
    const [formData, setFormData] = useState({
        workDate: new Date().toISOString().split('T')[0],
        checkIn: '',
        checkOut: '',
        rate: employee.overtimeRate > 0 ? employee.overtimeRate : employee.hourlyRate,
        notes: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        let parsedVal: string | number = value;
        if (name === 'rate') {
            const floatVal = parseFloat(value);
            parsedVal = isNaN(floatVal) ? 0 : floatVal;
        }
        
        setFormData(prev => ({ ...prev, [name]: parsedVal }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.checkIn || !formData.checkOut || !formData.workDate) {
            setToast({ message: 'يرجى ملء التاريخ ووقت الدخول والخروج.', type: 'error' });
            return;
        }

        const checkInTime = new Date(`1970-01-01T${formData.checkIn}`).getTime();
        const checkOutTime = new Date(`1970-01-01T${formData.checkOut}`).getTime();

        if (checkOutTime <= checkInTime) {
             setToast({ message: 'وقت الخروج يجب أن يكون بعد وقت الدخول.', type: 'error' });
            return;
        }

        const durationHours = (checkOutTime - checkInTime) / 3600000;
        const totalAmount = durationHours * (formData.rate as number);

        const newPayment: Omit<LeaveWorkPayment, 'id' | 'status' | 'paymentDate'> = {
            leaveRequestId: leaveRequest.id,
            employeeId: employee.id,
            workDate: formData.workDate,
            checkIn: formData.checkIn,
            checkOut: formData.checkOut,
            durationHours,
            rate: formData.rate as number,
            currency: employee.salaryCurrency || 'SYP',
            totalAmount,
            notes: formData.notes
        };
        
        await api.db.insert('leave_work_payments', newPayment);
        await refreshData();
        setToast({ message: 'تم تسجيل جلسة العمل بنجاح.', type: 'success' });
        onClose();
    };


    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`تسجيل عمل أثناء الإجازة لـ ${employee.name}`}>
            <form onSubmit={handleSubmit} className="p-2 space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700">التاريخ</label>
                    <input type="date" name="workDate" value={formData.workDate} onChange={handleChange} min={leaveRequest.startDate} max={leaveRequest.endDate} className="w-full p-2 border rounded-md" required />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">وقت الحضور</label>
                        <input type="time" name="checkIn" value={formData.checkIn} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">وقت الانصراف</label>
                        <input type="time" name="checkOut" value={formData.checkOut} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">أجر الساعة ({employee.salaryCurrency})</label>
                    <input type="number" step="any" name="rate" value={formData.rate || ''} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">ملاحظات</label>
                    <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className="w-full p-2 border rounded-md"></textarea>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                    <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">حفظ</button>
                </div>
            </form>
        </Modal>
    );
};

// --- Receipt Components ---
const LeaveReceipt: React.FC<{ data: any }> = ({ data }) => (
    <div className="printable-leave-receipt">
        <div className="receipt-content">{/* ... receipt layout ... */}</div>
    </div>
);
const WorkPaymentReceipt: React.FC<{ data: any }> = ({ data }) => (
    <div className="printable-receipt">
        <div className="receipt-content">
            {data.logoBase64 && <img src={data.logoBase64} alt="Logo" style={{ display: 'block', margin: '0 auto 8px auto', maxWidth: '70px', maxHeight: '50px' }} />}
            <h3 style={{ textAlign: 'center' }}>{data.companyName}</h3>
            <p style={{textAlign: 'center', fontSize: '8pt', fontWeight: 'bold', margin: '5px 0'}}>{data.receiptTitle}</p>
            <div className="line"></div>
            <div className="details">
                <div><span>الموظف:</span><span>{data.employeeName}</span></div>
                <div><span>التاريخ:</span><span>{data.date}</span></div>
            </div>
            <div className="line"></div>
            <div className="details total">
                <div><span>المبلغ:</span><span>{data.amount.toFixed(2)} {data.currency}</span></div>
            </div>
            <p>السبب: {data.reason || 'لم يذكر'}</p>
            <div className="signature"><p>التوقيع: .....................</p></div>
        </div>
    </div>
);

export default Leaves;
