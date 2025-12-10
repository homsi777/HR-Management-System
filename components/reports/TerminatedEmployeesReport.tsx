
import React from 'react';
import { PayrollCalculationResult } from '../../types';

interface ReportRow {
    id: number;
    employeeName: string;
    departmentName: string;
    jobTitleName: string;
    biometricId: string;
    terminationDate: string;
    reason: string;
    notes?: string;
    financialData?: PayrollCalculationResult;
}

interface TerminatedEmployeesReportProps {
    data: ReportRow[];
    requestSort: (key: string) => void;
    getSortIndicator: (key: string) => string | null;
}

const TerminatedEmployeesReport: React.FC<TerminatedEmployeesReportProps> = ({ data, requestSort, getSortIndicator }) => {
    if (data.length === 0) {
        return <div className="p-10 text-center text-gray-500">لا توجد بيانات لعرضها في الفترة المحددة.</div>;
    }
    
    return (
        <table className="min-w-full text-right text-sm">
            <thead className="bg-gray-50">
                <tr>
                    <th className="py-3 px-4"><button onClick={() => requestSort('employeeName')}>الموظف{getSortIndicator('employeeName')}</button></th>
                    <th className="py-3 px-4"><button onClick={() => requestSort('biometricId')}>معرف البصمة{getSortIndicator('biometricId')}</button></th>
                    <th className="py-3 px-4"><button onClick={() => requestSort('departmentName')}>القسم{getSortIndicator('departmentName')}</button></th>
                    <th className="py-3 px-4"><button onClick={() => requestSort('terminationDate')}>تاريخ الإنهاء{getSortIndicator('terminationDate')}</button></th>
                    <th className="py-3 px-4">السبب</th>
                    
                    {/* Financial Columns */}
                    <th className="py-3 px-4 font-semibold text-gray-700 bg-green-50">إجمالي المستحقات</th>
                    <th className="py-3 px-4 font-semibold text-gray-700 bg-red-50">إجمالي الخصميات</th>
                    <th className="py-3 px-4 font-bold text-blue-800 bg-blue-50">صافي المخالصة</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
                {data.map((row, index) => {
                    const f = row.financialData;
                    
                    // Safe calculation with default 0 for all fields
                    const totalEarnings = f 
                        ? ((f.baseSalary || 0) + (f.overtimePay || 0) + (f.bonusesTotal || 0)) 
                        : 0;
                        
                    const totalDeductions = f 
                        ? ((f.totalDeductions || 0) + (f.outstandingAdvances?.reduce((sum: number, a: any) => sum + (a.amount || 0), 0) || 0)) 
                        : 0;
                        
                    const netAmount = f ? (totalEarnings - totalDeductions) : 0;

                    return (
                        <tr key={row.id || index}>
                            <td className="py-4 px-4 font-medium">{row.employeeName}</td>
                            <td className="py-4 px-4 font-mono">{row.biometricId}</td>
                            <td className="py-4 px-4">{row.departmentName}</td>
                            <td className="py-4 px-4">{row.terminationDate}</td>
                            <td className="py-4 px-4 truncate max-w-xs" title={row.reason}>{row.reason}</td>
                            
                            <td className="py-4 px-4 bg-green-50/30 text-green-700 font-mono">
                                {f ? totalEarnings.toFixed(2) : '-'}
                            </td>
                            <td className="py-4 px-4 bg-red-50/30 text-red-700 font-mono">
                                {f ? totalDeductions.toFixed(2) : '-'}
                            </td>
                            <td className="py-4 px-4 bg-blue-50/30 text-blue-800 font-bold font-mono">
                                {f ? netAmount.toFixed(2) : '-'}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

export default TerminatedEmployeesReport;
