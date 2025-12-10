import React from 'react';
import { LeaveRequest, LeaveType, LeaveStatus } from '../../types';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const leaveTypeTranslations: Record<LeaveType, string> = { 'Annual': 'سنوية', 'Sick': 'مرضية', 'Emergency': 'طارئة', 'Unpaid': 'بدون راتب' };
const leaveStatusTranslations: Record<LeaveStatus, string> = { 'Approved': 'موافق عليه', 'Pending': 'قيد الانتظار', 'Rejected': 'مرفوض' };
const LEAVE_COLORS = { 'Annual': '#3B82F6', 'Sick': '#F59E0B', 'Emergency': '#EF4444', 'Unpaid': '#6B7280' };

interface ReportRow extends LeaveRequest {
    employeeName: string;
}

interface LeaveReportProps {
    data: ReportRow[];
    requestSort: (key: string) => void;
    getSortIndicator: (key: string) => string | null;
}

const LeaveReport: React.FC<LeaveReportProps> = ({ data, requestSort, getSortIndicator }) => {
    const leaveTypeCounts = data.reduce((acc, req) => {
        acc[req.type] = (acc[req.type] || 0) + 1;
        return acc;
    }, {} as Record<LeaveType, number>);
    const chartData = Object.entries(leaveTypeCounts).map(([name, value]) => ({ name: leaveTypeTranslations[name as LeaveType], value }));

    if (data.length === 0) {
        return <div className="p-10 text-center text-gray-500">لا توجد بيانات لعرضها في الفترة المحددة.</div>;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4">
            <div className="lg:col-span-2">
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6"><button onClick={() => requestSort('employeeName')}>الموظف{getSortIndicator('employeeName')}</button></th>
                            <th className="py-3 px-6"><button onClick={() => requestSort('type')}>نوع الإجازة{getSortIndicator('type')}</button></th>
                            <th className="py-3 px-6">الفترة</th>
                            <th className="py-3 px-6">الحالة</th>
                            <th className="py-3 px-6">السبب/ملاحظات الحالة</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {data.map((row) => (
                            <tr key={row.id}>
                                <td className="py-4 px-6">{row.employeeName}</td>
                                <td className="py-4 px-6">{leaveTypeTranslations[row.type]}</td>
                                <td className="py-4 px-6">{row.startDate} - {row.endDate}</td>
                                <td className="py-4 px-6">{leaveStatusTranslations[row.status]}</td>
                                <td className="py-4 px-6 text-sm">{row.reason} {row.statusReason && <span className='block text-xs text-blue-600'>(ملاحظة: {row.statusReason})</span>}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="lg:col-span-1 flex flex-col items-center justify-center h-[300px]">
                <h4 className="text-lg font-semibold mb-4">توزيع الإجازات حسب النوع</h4>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                            {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={LEAVE_COLORS[Object.keys(leaveTypeTranslations).find(key => leaveTypeTranslations[key as LeaveType] === entry.name) as LeaveType]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default LeaveReport;