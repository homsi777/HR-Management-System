import React from 'react';
import { AttendanceRecord } from '../../types';

interface ReportRow extends AttendanceRecord {
    employeeName: string;
}

interface ManualAttendanceReportProps {
    data: ReportRow[];
    requestSort: (key: string) => void;
    getSortIndicator: (key: string) => string | null;
}

const ManualAttendanceReport: React.FC<ManualAttendanceReportProps> = ({ data, requestSort, getSortIndicator }) => {
    if (data.length === 0) {
        return (
            <div className="p-10 text-center text-gray-500">
                لا توجد سجلات دوام يدوية في الفترة المحددة.
            </div>
        );
    }
    
    return (
        <table className="min-w-full text-right">
            <thead className="bg-gray-50">
                <tr>
                    <th className="py-3 px-6"><button onClick={() => requestSort('employeeName')}>الموظف{getSortIndicator('employeeName')}</button></th>
                    <th className="py-3 px-6"><button onClick={() => requestSort('date')}>التاريخ{getSortIndicator('date')}</button></th>
                    <th className="py-3 px-6"><button onClick={() => requestSort('checkIn')}>وقت الحضور{getSortIndicator('checkIn')}</button></th>
                    <th className="py-3 px-6"><button onClick={() => requestSort('checkOut')}>وقت الانصراف{getSortIndicator('checkOut')}</button></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
                {data.map((row) => (
                    <tr key={row.id}>
                        <td className="py-4 px-6">{row.employeeName}</td>
                        <td className="py-4 px-6">{row.date}</td>
                        <td className="py-4 px-6">{row.checkIn}</td>
                        <td className="py-4 px-6">{row.checkOut || 'لم يسجل'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default ManualAttendanceReport;