
import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { SalaryAdvance, Employee, SalaryAdvanceStatus, IElectronAPI, JobTitle, PrintSettings, SalaryCurrency } from '../types';
import Modal from './ui/Modal';
import { ICONS } from '../constants';

type SortableKeys = 'employeeName' | 'date' | 'amount' | 'status';

const advanceStatusTranslations: Record<SalaryAdvanceStatus, string> = { 'Pending': 'قيد الانتظار', 'Approved': 'موافق عليه', 'Rejected': 'مرفوض', 'Paid': 'مدفوع' };
const salaryCurrencyTranslations: Record<SalaryCurrency, string> = {
    'SYP': 'ليرة سوري',
    'USD': 'دولار أمريكي',
    'TRY': 'ليرة تركي'
};

interface SalaryAdvancesProps {
    salaryAdvances: SalaryAdvance[];
    employees: Employee[];
    jobTitles: JobTitle[];
    printSettings: PrintSettings | null;
    refreshData: () => Promise<void>;
    api: IElectronAPI;
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
}

const initialFormData: Omit<SalaryAdvance, 'id' | 'status'> = { employeeId: 0, amount: 0, currency: 'SYP', date: '', reason: '' };

const SalaryAdvances: React.FC<SalaryAdvancesProps> = ({ salaryAdvances, employees, jobTitles, refreshData, api, printSettings, setToast }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAdvance, setSelectedAdvance] = useState<SalaryAdvance | null>(null);
    const [formData, setFormData] = useState<Omit<SalaryAdvance, 'id' | 'status'>>(initialFormData);
    const [filterStatus, setFilterStatus] = useState<'all' | SalaryAdvanceStatus>('all');
    const [filterEmployeeId, setFilterEmployeeId] = useState<number | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({ key: 'date', direction: 'descending' });
    
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [statusChangeData, setStatusChangeData] = useState<{ advance: SalaryAdvance, newStatus: SalaryAdvanceStatus } | null>(null);
    const [statusReason, setStatusReason] = useState('');
    const [receiptData, setReceiptData] = useState<any | null>(null);

     useEffect(() => {
        if (receiptData) {
            const timer = setTimeout(() => {
                const receiptContent = document.querySelector('.printable-advance-receipt');
                if (receiptContent) {
                    api.app.print({ content: receiptContent.innerHTML })
                        .catch(err => console.error("Print failed:", err))
                        .finally(() => setReceiptData(null));
                } else {
                    console.error("Could not find printable advance receipt content.");
                    setReceiptData(null);
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [receiptData, api.app]);

    const getEmployeeName = (employeeId: number) => employees.find(e => e.id === employeeId)?.name || 'Unknown';
    const getJobTitleName = (employeeId: number) => {
        const emp = employees.find(e => e.id === employeeId);
        return emp ? (jobTitles.find(j => j.id === emp.jobTitleId)?.name || 'N/A') : 'N/A';
    };

    const filteredAndSortedAdvances = useMemo(() => {
        let filtered = salaryAdvances.filter(adv =>
            (filterStatus === 'all' || adv.status === filterStatus) &&
            (filterEmployeeId === 'all' || adv.employeeId === filterEmployeeId) &&
            (searchTerm === '' || getEmployeeName(adv.employeeId).toLowerCase().includes(searchTerm.toLowerCase()))
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
    }, [salaryAdvances, filterStatus, filterEmployeeId, sortConfig, employees, searchTerm]);

    const requestSort = (key: SortableKeys) => {
        setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending' }));
    };

    const getSortIndicator = (key: SortableKeys) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    const openStatusModal = (advance: SalaryAdvance, newStatus: SalaryAdvanceStatus) => {
        setStatusChangeData({ advance, newStatus });
        setStatusReason(advance.statusReason || '');
        setIsStatusModalOpen(true);
    };

    const handleConfirmStatusChange = async () => {
        if (!statusChangeData) return;
        await api.db.update('salaryAdvances', statusChangeData.advance.id, { 
            status: statusChangeData.newStatus,
            statusReason: statusReason
        });
        await refreshData();
        setIsStatusModalOpen(false);
        setStatusChangeData(null);
        setStatusReason('');
    };
    
    const handleAdd = () => {
        setSelectedAdvance(null);
        const firstEmployee = employees.find(e => e.status === 'active');
        setFormData({
            employeeId: firstEmployee?.id || 0,
            date: new Date().toISOString().split('T')[0],
            amount: 0,
            reason: '',
            currency: firstEmployee?.salaryCurrency || 'SYP'
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف طلب السلفة هذا؟')) {
            await api.db.delete('salaryAdvances', id);
            await refreshData();
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        if (name === 'employeeId') {
            const selectedEmployee = employees.find(emp => emp.id === Number(value));
            setFormData(prev => ({ 
                ...prev, 
                employeeId: Number(value),
                currency: selectedEmployee?.salaryCurrency || 'SYP'
            }));
        } else {
            const isNumeric = ['amount'].includes(name);
            let parsedVal: string | number = value;
            if (isNumeric) {
                const floatVal = parseFloat(value);
                parsedVal = isNaN(floatVal) ? 0 : floatVal;
            }
            setFormData(prev => ({ ...prev, [name]: parsedVal }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.employeeId || !formData.date || formData.amount <= 0) {
            setToast({ message: 'يرجى ملء جميع الحقول المطلوبة والتأكد من أن مبلغ السلفة أكبر من صفر.', type: 'error' });
            return;
        }
        if (selectedAdvance) {
            await api.db.update('salaryAdvances', selectedAdvance.id, formData);
            setToast({ message: 'تم تحديث السلفة بنجاح.', type: 'success' });
            await refreshData();
            setIsModalOpen(false);
        } else {
            await api.db.insert('salaryAdvances', { ...formData, status: 'Pending' });
            setToast({ message: 'تم إرسال طلب السلفة للموافقة.', type: 'success' });
            await refreshData();
            // Reset form but keep modal open for next entry
            setFormData({ employeeId: formData.employeeId, date: new Date().toISOString().split('T')[0], amount: 0, reason: '', currency: formData.currency });
        }
    };

    const handleExport = () => {
        const dataToExport = filteredAndSortedAdvances.map(adv => ({
            'الموظف': getEmployeeName(adv.employeeId),
            'التاريخ': adv.date,
            'المبلغ': `${adv.amount} ${adv.currency}`,
            'السبب': adv.reason,
            'الحالة': advanceStatusTranslations[adv.status],
            'ملاحظات': adv.statusReason || ''
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Salary Advances Report");
        XLSX.writeFile(wb, "salary_advances_report.xlsx");
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

    const handlePrintAdvance = async (advance: SalaryAdvance) => {
        const employee = employees.find(e => e.id === advance.employeeId);
        
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
            receiptTitle: `${printSettings?.receiptTitle || 'إيصال'} استلام سلفة`,
            template: printSettings?.template || 'template1',
            employeeName: employee?.name || 'N/A',
            jobTitleName: getJobTitleName(advance.employeeId),
            date: advance.date,
            amount: advance.amount,
            reason: advance.reason,
            currency: advance.currency
        };

        setReceiptData(data);
    };
    
    const AdvanceReceipt = ({ data }: { data: any }) => (
        <div className="printable-advance-receipt">
            <div className="receipt-content">
                {data.template === 'template1' && (
                    <>
                        {data.logoBase64 && <img src={data.logoBase64} alt="Logo" style={{ display: 'block', margin: '0 auto 8px auto', maxWidth: '70px', maxHeight: '50px' }} />}
                        <h3 style={{ textAlign: 'center' }}>{data.companyName}</h3>
                        {data.address && <p style={{ textAlign: 'center', fontSize: '7pt' }}>{data.address}</p>}
                        {data.phone && <p style={{ textAlign: 'center', fontSize: '7pt' }}>{data.phone}</p>}
                    </>
                )}
                {data.template === 'template2' && (
                    <>
                        <h3 style={{ textAlign: 'left' }}>{data.companyName}</h3>
                        {data.address && <p style={{ textAlign: 'left', fontSize: '7pt' }}>{data.address}</p>}
                        {data.phone && <p style={{ textAlign: 'left', fontSize: '7pt' }}>{data.phone}</p>}
                    </>
                )}
                 {data.template === 'template3' && (
                    <>
                        <h3 style={{ textAlign: 'right' }}>{data.companyName}</h3>
                        {data.address && <p style={{ textAlign: 'right', fontSize: '7pt' }}>{data.address}</p>}
                        {data.phone && <p style={{ textAlign: 'right', fontSize: '7pt' }}>{data.phone}</p>}
                    </>
                )}
                <p style={{textAlign: 'center', fontSize: '8pt', fontWeight: 'bold', margin: '5px 0'}}>{data.receiptTitle}</p>
                <div className="line"></div>
                <div className="details">
                    <div><span>الموظف:</span><span>{data.employeeName}</span></div>
                    <div><span>المسمى الوظيفي:</span><span>{data.jobTitleName}</span></div>
                    <div><span>تاريخ الاستلام:</span><span>{data.date}</span></div>
                </div>
                <div className="line"></div>
                <div className="details total">
                    <div><span>المبلغ:</span><span>{data.amount.toFixed(2)} {data.currency}</span></div>
                </div>
                <div className="line"></div>
                <p style={{marginBottom: '2px', fontWeight: 'bold'}}>السبب:</p>
                <p>{data.reason || 'لم يذكر'}</p>
                <div className="signature">
                    <p>توقيع المستلم:</p>
                    <br/>
                    <p>.............................</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className={`p-6 ${receiptData ? 'is-printing' : ''}`}>
            <div className="flex justify-between items-center mb-6 no-print">
                <h2 className="text-2xl font-bold text-neutral">طلبات السلف</h2>
                 <div className="flex items-center gap-2">
                    <button onClick={handleExport} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2">{ICONS.export} تصدير</button>
                    <button onClick={handlePrint} className="bg-gray-600 text-white p-2 rounded-lg hover:bg-gray-700 transition flex items-center gap-2">{ICONS.print} طباعة</button>
                    <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition">طلب سلفة جديد</button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-md mb-6 flex flex-wrap items-center gap-4 no-print">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="p-2 border rounded-lg bg-white">
                    <option value="all">كل الحالات</option>
                    {Object.entries(advanceStatusTranslations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
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
                            <th className="py-3 px-6"><button onClick={() => requestSort('employeeName')} className="font-medium">الموظف{getSortIndicator('employeeName')}</button></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('date')} className="font-medium">التاريخ{getSortIndicator('date')}</button></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('amount')} className="font-medium">المبلغ{getSortIndicator('amount')}</button></th>
                            <th className="py-3 px-6">السبب والملاحظات</th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('status')} className="font-medium">الحالة{getSortIndicator('status')}</button></th>
                            <th className="py-3 px-6 no-print">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredAndSortedAdvances.map(advance => (
                            <tr key={advance.id}>
                                <td className="py-4 px-6">{getEmployeeName(advance.employeeId)}</td>
                                <td className="py-4 px-6">{advance.date}</td>
                                <td className="py-4 px-6 font-semibold">{`${advance.amount.toFixed(2)} ${salaryCurrencyTranslations[advance.currency] || advance.currency}`}</td>
                                 <td className="py-4 px-6 truncate max-w-xs">
                                    {advance.reason}
                                    {advance.statusReason && <p className="text-xs text-blue-600 mt-1">ملاحظة: {advance.statusReason}</p>}
                                </td>
                                <td className="py-4 px-6">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        advance.status === 'Approved' ? 'bg-blue-100 text-blue-800' :
                                        advance.status === 'Paid' ? 'bg-green-100 text-green-800' :
                                        advance.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {advanceStatusTranslations[advance.status]}
                                    </span>
                                </td>
                                <td className="py-4 px-6 no-print space-x-2 space-x-reverse whitespace-nowrap">
                                    {advance.status === 'Pending' && (
                                        <>
                                            <button onClick={() => openStatusModal(advance, 'Approved')} className="text-green-600 hover:text-green-800 font-medium">موافقة</button>
                                            <button onClick={() => openStatusModal(advance, 'Rejected')} className="text-orange-600 hover:text-orange-800 font-medium">رفض</button>
                                        </>
                                    )}
                                    <button onClick={() => handlePrintAdvance(advance)} className="bg-gray-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-gray-600">طباعة</button>
                                    <button onClick={() => handleDelete(advance.id)} className="text-red-600 hover:text-red-800 p-1">{React.cloneElement(ICONS.delete, {className: "h-5 w-5"})}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <Modal title="طلب سلفة جديد" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <form onSubmit={handleSubmit} className="space-y-4 p-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">الموظف</label>
                        <select name="employeeId" value={formData.employeeId} onChange={handleChange} className="w-full p-2 border rounded-md bg-white" required>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                    </div>
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className='md:col-span-2'>
                            <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
                            <input name="amount" type="number" step="any" min="0" value={formData.amount || ''} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">العملة</label>
                            <select name="currency" value={formData.currency} onChange={handleChange} className="w-full p-2 border rounded-md bg-white" required>
                                {Object.entries(salaryCurrencyTranslations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
                            <input name="date" type="date" value={formData.date} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">السبب</label>
                        <textarea name="reason" value={formData.reason} onChange={handleChange} rows={3} className="w-full p-2 border rounded-md"></textarea>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إغلاق</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">إضافة وحفظ</button>
                    </div>
                </form>
            </Modal>
            
            <Modal title="تغيير حالة طلب السلفة" isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)}>
                <div className="p-2 space-y-4">
                    <p>هل أنت متأكد من {statusChangeData?.newStatus === 'Approved' ? 'الموافقة على' : 'رفض'} طلب السلفة للموظف <strong>{getEmployeeName(statusChangeData?.advance.employeeId || 0)}</strong>؟</p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">إضافة ملاحظة (اختياري)</label>
                        <textarea value={statusReason} onChange={(e) => setStatusReason(e.target.value)} rows={3} className="w-full p-2 border rounded-md" placeholder="مثال: تمت الموافقة، سيتم خصمها من الراتب القادم..."></textarea>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={() => setIsStatusModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button onClick={handleConfirmStatusChange} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">تأكيد</button>
                    </div>
                </div>
            </Modal>
            {receiptData && <AdvanceReceipt data={receiptData} />}
        </div>
    );
};

export default SalaryAdvances;
