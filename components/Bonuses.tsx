
import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Bonus, Deduction, Employee, SalaryCurrency, IElectronAPI, PrintSettings } from '../types';
import Modal from './ui/Modal';
import { ICONS } from '../constants';

type SortableKeys = 'employeeName' | 'date' | 'amount' | 'type';

const salaryCurrencyTranslations: Record<SalaryCurrency, string> = {
    'SYP': 'ليرة سوري',
    'USD': 'دولار أمريكي',
    'TRY': 'ليرة تركي'
};

interface BonusesAndDeductionsProps {
    bonuses: Bonus[];
    deductions: Deduction[];
    employees: Employee[];
    printSettings: PrintSettings | null;
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
    api: IElectronAPI;
}

const initialBonusFormData: Omit<Bonus, 'id'> = { employeeId: 0, amount: 0, currency: 'SYP', date: '', reason: '' };
const initialDeductionFormData: Omit<Deduction, 'id'> = { employeeId: 0, amount: 0, currency: 'SYP', date: '', reason: '' };

const BonusesAndDeductions: React.FC<BonusesAndDeductionsProps> = ({ bonuses, deductions, employees, refreshData, setToast, api, printSettings }) => {
    // Bonus Modal State
    const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
    const [selectedBonus, setSelectedBonus] = useState<Bonus | null>(null);
    const [bonusFormData, setBonusFormData] = useState<Omit<Bonus, 'id'>>(initialBonusFormData);
    
    // Deduction Modal State
    const [isDeductionModalOpen, setIsDeductionModalOpen] = useState(false);
    const [selectedDeduction, setSelectedDeduction] = useState<Deduction | null>(null);
    const [deductionFormData, setDeductionFormData] = useState<Omit<Deduction, 'id'>>(initialDeductionFormData);

    // Common State
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({ key: 'date', direction: 'descending' });
    const [receiptData, setReceiptData] = useState<any | null>(null);

    // Print useEffect
    useEffect(() => {
        if (receiptData) {
            const timer = setTimeout(() => {
                const receiptContent = document.querySelector('.printable-receipt');
                if (receiptContent) {
                    api.app.print({ content: receiptContent.innerHTML })
                        .catch(err => console.error("Print failed:", err))
                        .finally(() => setReceiptData(null));
                } else {
                    setToast({ message: 'لم يتم العثور على محتوى الإيصال.', type: 'error' });
                    setReceiptData(null);
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [receiptData, api.app, setToast]);

    const getEmployeeName = (employeeId: number) => employees.find(e => e.id === employeeId)?.name || 'Unknown';

    const combinedData = useMemo(() => {
        const data = [
            ...bonuses.map(item => ({ ...item, type: 'bonus' as const })),
            ...deductions.map(item => ({ ...item, type: 'deduction' as const }))
        ];

        let filtered = data.filter(item =>
            searchTerm === '' || getEmployeeName(item.employeeId).toLowerCase().includes(searchTerm.toLowerCase())
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
    }, [bonuses, deductions, searchTerm, sortConfig, employees]);

    const requestSort = (key: SortableKeys) => {
        setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending' }));
    };

    const getSortIndicator = (key: SortableKeys) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };
    
    // --- Bonus Handlers ---
    const handleAddBonus = () => {
        setSelectedBonus(null);
        setBonusFormData({ ...initialBonusFormData, date: new Date().toISOString().split('T')[0], employeeId: employees.find(e => e.status === 'active')?.id || 0 });
        setIsBonusModalOpen(true);
    };

    const handleEditBonus = (bonus: Bonus) => {
        setSelectedBonus(bonus);
        // Ensure we strip any extra properties when setting form data, although state type protects us mostly,
        // specifically 'type' property from combinedData needs to be ignored during submit.
        setBonusFormData(bonus);
        setIsBonusModalOpen(true);
    };

    const handleDeleteBonus = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذه المكافأة؟')) {
            await api.db.delete('bonuses', id);
            await refreshData();
            setToast({ message: 'تم حذف المكافأة بنجاح.', type: 'success' });
        }
    };
    
    const handleBonusSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Prepare clean data object to avoid sending 'type' field which causes SqliteError
        const dataToSubmit = {
            employeeId: bonusFormData.employeeId,
            amount: parseFloat(bonusFormData.amount.toString()) || 0, // Ensure it's a float
            currency: bonusFormData.currency,
            date: bonusFormData.date,
            reason: bonusFormData.reason
        };

        if (selectedBonus) {
            await api.db.update('bonuses', selectedBonus.id, dataToSubmit);
        } else {
            await api.db.insert('bonuses', dataToSubmit);
        }
        await refreshData();
        setIsBonusModalOpen(false);
    };

    // --- Deduction Handlers ---
    const handleAddDeduction = () => {
        setSelectedDeduction(null);
        setDeductionFormData({ ...initialDeductionFormData, date: new Date().toISOString().split('T')[0], employeeId: employees.find(e => e.status === 'active')?.id || 0 });
        setIsDeductionModalOpen(true);
    };

    const handleEditDeduction = (deduction: Deduction) => {
        setSelectedDeduction(deduction);
        setDeductionFormData(deduction);
        setIsDeductionModalOpen(true);
    };

    const handleDeleteDeduction = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذا الخصم؟')) {
            await api.db.delete('deductions', id);
            await refreshData();
            setToast({ message: 'تم حذف الخصم بنجاح.', type: 'success' });
        }
    };

    const handleDeductionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Prepare clean data object to avoid sending 'type' field which causes SqliteError
        const dataToSubmit = {
            employeeId: deductionFormData.employeeId,
            amount: parseFloat(deductionFormData.amount.toString()) || 0, // Ensure it's a float
            currency: deductionFormData.currency,
            date: deductionFormData.date,
            reason: deductionFormData.reason
        };

        if (selectedDeduction) {
            await api.db.update('deductions', selectedDeduction.id, dataToSubmit);
        } else {
            await api.db.insert('deductions', dataToSubmit);
        }
        await refreshData();
        setIsDeductionModalOpen(false);
    };

    // --- Print Handlers ---
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

    const handlePrint = async (item: Bonus | Deduction, type: 'bonus' | 'deduction') => {
        const employee = employees.find(e => e.id === item.employeeId);
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
            address: printSettings?.address || "",
            phone: printSettings?.phone || "",
            receiptTitle: type === 'bonus' ? 'إيصال مكافأة' : 'إيصال خصم',
            template: printSettings?.template || 'template1',
            employeeName: employee.name,
            date: item.date,
            amount: item.amount,
            reason: item.reason,
            currency: item.currency,
        };

        setReceiptData(data);
    };
    
    const Receipt = ({ data }: { data: any }) => (
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

    return (
        <div className={`p-6 ${receiptData ? 'is-printing' : ''}`}>
            <div className="flex justify-between items-center mb-6 no-print">
                <h2 className="text-2xl font-bold text-neutral">المكافآت والخصومات</h2>
                <div className="flex items-center gap-2">
                    <button onClick={handleAddDeduction} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition">إضافة خصم جديد</button>
                    <button onClick={handleAddBonus} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition">إضافة مكافأة جديدة</button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-md mb-6 no-print">
                <input
                    type="text"
                    placeholder="بحث باسم الموظف..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="p-2 border rounded-lg bg-white w-full"
                />
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6"><button onClick={() => requestSort('employeeName')} className="font-medium">الموظف{getSortIndicator('employeeName')}</button></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('type')} className="font-medium">النوع{getSortIndicator('type')}</button></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('date')} className="font-medium">التاريخ{getSortIndicator('date')}</button></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('amount')} className="font-medium">المبلغ{getSortIndicator('amount')}</button></th>
                            <th className="py-3 px-6">السبب</th>
                            <th className="py-3 px-6 no-print">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {combinedData.map(item => (
                            <tr key={`${item.type}-${item.id}`}>
                                <td className="py-4 px-6">{getEmployeeName(item.employeeId)}</td>
                                <td className="py-4 px-6">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.type === 'bonus' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {item.type === 'bonus' ? 'مكافأة' : 'خصم'}
                                    </span>
                                </td>
                                <td className="py-4 px-6">{item.date}</td>
                                <td className={`py-4 px-6 font-semibold ${item.type === 'bonus' ? 'text-green-600' : 'text-red-600'}`}>
                                    {`${item.amount.toFixed(2)} ${salaryCurrencyTranslations[item.currency]}`}
                                </td>
                                <td className="py-4 px-6 truncate max-w-xs">{item.reason}</td>
                                <td className="py-4 px-6 space-x-2 space-x-reverse whitespace-nowrap">
                                    <button onClick={() => handlePrint(item, item.type)} className="text-gray-500 hover:text-gray-700 p-1">{React.cloneElement(ICONS.print, { className: "h-5 w-5" })}</button>
                                    <button onClick={() => item.type === 'bonus' ? handleEditBonus(item) : handleEditDeduction(item)} className="text-primary hover:text-primary-dark p-1">{React.cloneElement(ICONS.edit, { className: "h-5 w-5" })}</button>
                                    <button onClick={() => item.type === 'bonus' ? handleDeleteBonus(item.id) : handleDeleteDeduction(item.id)} className="text-red-600 hover:text-red-800 p-1">{React.cloneElement(ICONS.delete, { className: "h-5 w-5" })}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {combinedData.length === 0 && <p className="text-center py-10 text-gray-500">لا توجد بيانات مسجلة.</p>}
            </div>

            {/* Bonus Modal */}
            <Modal title={selectedBonus ? "تعديل مكافأة" : "إضافة مكافأة جديدة"} isOpen={isBonusModalOpen} onClose={() => setIsBonusModalOpen(false)}>
                <form onSubmit={handleBonusSubmit} className="space-y-4 p-2">
                    <GenericFormFields data={bonusFormData} setData={setBonusFormData} employees={employees} />
                    <FormActions onClose={() => setIsBonusModalOpen(false)} isEditing={!!selectedBonus} />
                </form>
            </Modal>
            
            {/* Deduction Modal */}
            <Modal title={selectedDeduction ? "تعديل خصم" : "إضافة خصم جديد"} isOpen={isDeductionModalOpen} onClose={() => setIsDeductionModalOpen(false)}>
                <form onSubmit={handleDeductionSubmit} className="space-y-4 p-2">
                    <GenericFormFields data={deductionFormData} setData={setDeductionFormData} employees={employees} />
                    <FormActions onClose={() => setIsDeductionModalOpen(false)} isEditing={!!selectedDeduction} />
                </form>
            </Modal>
            {receiptData && <Receipt data={receiptData} />}
        </div>
    );
};

const GenericFormFields = ({ data, setData, employees }: { data: Omit<Bonus, 'id'> | Omit<Deduction, 'id'>, setData: Function, employees: Employee[] }) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        // Check if field should be numeric
        const isNumeric = ['employeeId', 'amount'].includes(name);
        
        let parsedValue: string | number = value;
        if (isNumeric) {
            if (name === 'amount') {
                const floatVal = parseFloat(value);
                // Return 0 if NaN to avoid React Warning: Received NaN
                parsedValue = isNaN(floatVal) ? 0 : floatVal;
            } else {
                parsedValue = Number(value);
            }
        }
            
        setData((prev: any) => ({ ...prev, [name]: parsedValue }));
    };
    return <>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">الموظف</label><select name="employeeId" value={data.employeeId} onChange={handleChange} className="w-full p-2 border rounded-md bg-white" required><option value={0} disabled>-- اختر موظف --</option>{employees.filter(e => e.status === 'active').map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">المبلغ</label><input name="amount" type="number" step="any" min="0" value={data.amount || ''} onChange={handleChange} className="w-full p-2 border rounded-md" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">العملة</label><select name="currency" value={data.currency} onChange={handleChange} className="w-full p-2 border rounded-md bg-white" required>{Object.entries(salaryCurrencyTranslations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label><input name="date" type="date" value={data.date} onChange={handleChange} className="w-full p-2 border rounded-md" required /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">السبب</label><textarea name="reason" value={data.reason} onChange={handleChange} rows={3} className="w-full p-2 border rounded-md"></textarea></div>
    </>
};

const FormActions = ({ onClose, isEditing }: { onClose: () => void, isEditing: boolean }) => (
    <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">{isEditing ? 'حفظ' : 'إضافة'}</button>
    </div>
);


export default BonusesAndDeductions;
