
import React from 'react';

interface ReportRow {
    employeeId: number;
    employeeName: string;
    baseSalary: number;
    bonuses: number;
    overtimePay: number;
    totalDeductions: number;
    advances: number;
    netSalary: number;
    salaryCurrency: string;
    calculateSalaryBy30Days?: boolean;
    totalOvertimeHours: number;
    latenessDeductions?: number;
    unpaidLeaveDeductions?: number;
}

interface PayrollReportProps {
    data: ReportRow[];
    requestSort: (key: string) => void;
    getSortIndicator: (key: string) => string | null;
}

const PayrollReport: React.FC<PayrollReportProps> = ({ data, requestSort, getSortIndicator }) => {
    if (data.length === 0) {
        return <div className="p-10 text-center text-gray-500">لا توجد بيانات لعرضها في الفترة المحددة.</div>;
    }

    return (
        <table className="min-w-full text-right text-sm">
            <thead className="bg-gray-50">
                <tr>
                    <th className="py-3 px-2"><button onClick={() => requestSort('employeeName')}>الموظف{getSortIndicator('employeeName')}</button></th>
                    <th className="py-3 px-2"><button onClick={() => requestSort('baseSalary')}>الأساسي{getSortIndicator('baseSalary')}</button></th>
                    <th className="py-3 px-2"><button onClick={() => requestSort('bonuses')}>مكافآت{getSortIndicator('bonuses')}</button></th>
                    <th className="py-3 px-2"><button onClick={() => requestSort('totalOvertimeHours')}>س.إضافي{getSortIndicator('totalOvertimeHours')}</button></th>
                    <th className="py-3 px-2 font-semibold text-green-700"><button onClick={() => requestSort('overtimePay')}>قيمة الإضافي{getSortIndicator('overtimePay')}</button></th>
                    <th className="py-3 px-2 font-semibold text-red-700" title="يشمل: تأخير + غياب + خصميات يدوية"><button onClick={() => requestSort('totalDeductions')}>إجمالي الخصم{getSortIndicator('totalDeductions')}</button></th>
                    <th className="py-3 px-2 text-orange-700"><button onClick={() => requestSort('advances')}>السلف{getSortIndicator('advances')}</button></th>
                    <th className="py-3 px-2 font-bold bg-gray-100"><button onClick={() => requestSort('netSalary')}>الصافي المستحق{getSortIndicator('netSalary')}</button></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
                {data.map((row) => (
                    <tr key={row.employeeId} className="hover:bg-gray-50">
                        <td className="py-4 px-2">
                            <div className="flex items-center">
                                <span className="font-medium">{row.employeeName}</span>
                                {row.calculateSalaryBy30Days && (
                                    <span className="mr-1 text-blue-500" title="راتب مقطوع (30 يوم)">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    </span>
                                )}
                            </div>
                        </td>
                        <td className="py-4 px-2">{`${(row.baseSalary || 0).toFixed(2)}`}</td>
                        <td className="py-4 px-2 text-green-600">{`+ ${(row.bonuses || 0).toFixed(2)}`}</td>
                        <td className="py-4 px-2">{`${(row.totalOvertimeHours || 0).toFixed(2)}`}</td>
                        <td className="py-4 px-2 font-medium text-green-700 bg-green-50">{`${(row.overtimePay || 0).toFixed(2)}`}</td>
                        <td className="py-4 px-2 font-medium text-red-700 bg-red-50">
                            {`- ${(row.totalDeductions || 0).toFixed(2)}`}
                        </td>
                        <td className="py-4 px-2 text-orange-600">{`- ${(row.advances || 0).toFixed(2)}`}</td>
                        <td className="py-4 px-2 font-bold text-gray-900 bg-gray-100 border-r-2 border-gray-200">
                            {`${(row.netSalary || 0).toFixed(2)} ${row.salaryCurrency}`}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default PayrollReport;
