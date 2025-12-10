import React from 'react';

interface ReportRow {
    employeeId: number;
    employeeName: string;
    presentDays: number;
    absentDays: number;
    leaveDays: number;
    lateCount: number;
}

interface AttendanceSummaryReportProps {
    data: ReportRow[];
    requestSort: (key: string) => void;
    getSortIndicator: (key: string) => string | null;
}

const AttendanceSummaryReport: React.FC<AttendanceSummaryReportProps> = ({ data, requestSort, getSortIndicator }) => {
    if (data.length === 0) {
        return <div className="p-10 text-center text-gray-500">لا توجد بيانات لعرضها في الفترة المحددة.</div>;
    }

    return (
        <table className="min-w-full text-right">
            <thead className="bg-gray-50">
                <tr>
                    <th className="py-3 px-6"><button onClick={() => requestSort('employeeName')}>الموظف{getSortIndicator('employeeName')}</button></th>
                    <th className="py-3 px-6"><button onClick={() => requestSort('presentDays')}>أيام الحضور{getSortIndicator('presentDays')}</button></th>
                    <th className="py-3 px-6"><button onClick={() => requestSort('absentDays')}>أيام الغياب{getSortIndicator('absentDays')}</button></th>
                    <th className="py-3 px-6"><button onClick={() => requestSort('leaveDays')}>أيام الإجازة{getSortIndicator('leaveDays')}</button></th>
                    <th className="py-3 px-6"><button onClick={() => requestSort('lateCount')}>عدد مرات التأخير{getSortIndicator('lateCount')}</button></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
                {data.map((row) => (
                    <tr key={row.employeeId}>
                        <td className="py-4 px-6">{row.employeeName}</td>
                        <td className="py-4 px-6">{row.presentDays}</td>
                        <td className="py-4 px-6">{row.absentDays}</td>
                        <td className="py-4 px-6">{row.leaveDays}</td>
                        <td className="py-4 px-6">{row.lateCount}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default AttendanceSummaryReport;