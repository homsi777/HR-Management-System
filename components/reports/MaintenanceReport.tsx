
import React from 'react';
import { MaintenanceRecord, SalaryCurrency } from '../../types';

interface ReportRow extends MaintenanceRecord {
    employeeName: string;
}

interface MaintenanceReportProps {
    data: ReportRow[];
    requestSort: (key: string) => void;
    getSortIndicator: (key: string) => string | null;
}

const MaintenanceReport: React.FC<MaintenanceReportProps> = ({ data, requestSort, getSortIndicator }) => {
    
    const currencyTotals = data.reduce((acc, record) => {
        const amount = Number(record.amount) || 0;
        if (!acc[record.currency]) {
            acc[record.currency] = 0;
        }
        acc[record.currency] += amount;
        return acc;
    }, {} as Record<SalaryCurrency, number>);

    return (
        <div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-b">
                <h4 className="text-lg font-bold text-neutral md:col-span-3">ملخص المبالغ المستلمة</h4>
                {Object.keys(currencyTotals).length > 0 ? Object.entries(currencyTotals).map(([currency, total]) => (
                    <div key={currency} className="bg-blue-50 p-3 rounded-lg text-center">
                        <p className="text-sm text-blue-800">إجمالي {currency}</p>
                        <p className="text-2xl font-bold text-blue-900">{(Number(total) || 0).toFixed(2)}</p>
                    </div>
                )) : <p className="md:col-span-3 text-gray-500">لا توجد مبالغ مسجلة.</p>}
            </div>
            {data.length === 0 ? (
                 <div className="p-10 text-center text-gray-500">لا توجد بيانات لعرضها في الفترة المحددة.</div>
            ) : (
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6"><button onClick={() => requestSort('employeeName')}>الموظف{getSortIndicator('employeeName')}</button></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('date')}>التاريخ{getSortIndicator('date')}</button></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('amount')}>المبلغ{getSortIndicator('amount')}</button></th>
                            <th className="py-3 px-6">ملاحظات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {data.map((row, index) => (
                            <tr key={row.id || index}>
                                <td className="py-4 px-6">{row.employeeName}</td>
                                <td className="py-4 px-6">{row.date}</td>
                                <td className="py-4 px-6 font-medium text-gray-800">
                                    {`${(Number(row.amount) || 0).toFixed(2)} ${row.currency}`}
                                </td>
                                <td className="py-4 px-6">{row.notes}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default MaintenanceReport;
