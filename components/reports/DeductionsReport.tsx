
import React from 'react';
import { SalaryCurrency } from '../../types';

interface ReportRow {
    id: number;
    employeeName: string;
    date: string;
    amount: number;
    currency: SalaryCurrency;
    reason: string;
}

interface DeductionsReportProps {
    data: ReportRow[];
    requestSort: (key: string) => void;
    getSortIndicator: (key: string) => string | null;
}

const DeductionsReport: React.FC<DeductionsReportProps> = ({ data, requestSort, getSortIndicator }) => {
    if (data.length === 0) {
        return <div className="p-10 text-center text-gray-500">لا توجد بيانات لعرضها في الفترة المحددة.</div>;
    }

    return (
        <table className="min-w-full text-right">
            <thead className="bg-gray-50">
                <tr>
                    <th className="py-3 px-6"><button onClick={() => requestSort('employeeName')}>الموظف{getSortIndicator('employeeName')}</button></th>
                    <th className="py-3 px-6"><button onClick={() => requestSort('date')}>التاريخ{getSortIndicator('date')}</button></th>
                    <th className="py-3 px-6"><button onClick={() => requestSort('amount')}>المبلغ{getSortIndicator('amount')}</button></th>
                    <th className="py-3 px-6">السبب</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
                {data.map((row, index) => (
                    <tr key={row.id || index}>
                        <td className="py-4 px-6">{row.employeeName}</td>
                        <td className="py-4 px-6">{row.date}</td>
                        <td className="py-4 px-6 font-medium text-red-600">
                            {`${(Number(row.amount) || 0).toFixed(2)} ${row.currency || ''}`}
                        </td>
                        <td className="py-4 px-6">{row.reason}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default DeductionsReport;
