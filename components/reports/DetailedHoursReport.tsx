
import React, { useState } from 'react';
import Modal from '../ui/Modal';

// Helper function to convert decimal hours to a "Hh Mm" string
const decimalHoursToHm = (decimalHours: number): string => {
  if (isNaN(decimalHours) || decimalHours < 0) {
      decimalHours = 0;
  }
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return `${hours} س ${minutes} د`;
};

interface DetailedHoursSummaryRow {
    employeeId: number;
    employeeName: string;
    totalRequiredHours: number;
    totalActualHours: number;
    totalRegularWorked: number;
    totalOvertime: number;
    detailedRecords: Array<{
        date: string;
        dayName: string;
        status: string;
        checkIn: string;
        checkOut: string;
        required: number;
        actual: number;
        regular: number;
        overtime: number;
    }>;
}

interface DetailedHoursReportProps {
    data: DetailedHoursSummaryRow[];
    requestSort: (key: string) => void;
    getSortIndicator: (key: string) => string | null;
}

const DetailedHoursReport: React.FC<DetailedHoursReportProps> = ({ data, requestSort, getSortIndicator }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState<DetailedHoursSummaryRow | null>(null);

    const handleRowClick = (employeeData: DetailedHoursSummaryRow) => {
        setSelectedEmployeeDetails(employeeData);
        setIsModalOpen(true);
    };

    if (data.length === 0) {
        return <div className="p-10 text-center text-gray-500">لا توجد بيانات لعرضها في الفترة المحددة.</div>;
    }

    return (
        <>
            <table className="min-w-full text-right">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="py-3 px-6"><button onClick={() => requestSort('employeeName')}>الموظف{getSortIndicator('employeeName')}</button></th>
                        <th className="py-3 px-6"><button onClick={() => requestSort('totalRequiredHours')}>إجمالي الساعات المقررة{getSortIndicator('totalRequiredHours')}</button></th>
                        <th className="py-3 px-6"><button onClick={() => requestSort('totalRegularWorked')}>الساعات الأساسية المنجزة{getSortIndicator('totalRegularWorked')}</button></th>
                        <th className="py-3 px-6"><button onClick={() => requestSort('totalOvertime')}>الساعات الإضافية{getSortIndicator('totalOvertime')}</button></th>
                        <th className="py-3 px-6"><button onClick={() => requestSort('totalActualHours')}>إجمالي الفعلي{getSortIndicator('totalActualHours')}</button></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {data.map((row) => (
                        <tr 
                            key={row.employeeId} 
                            onClick={() => handleRowClick(row)} 
                            className="cursor-pointer hover:bg-blue-50/50 transition-colors"
                        >
                            <td className="py-4 px-6 font-semibold text-primary">{row.employeeName}</td>
                            <td className="py-4 px-6 font-medium text-gray-700">{decimalHoursToHm(row.totalRequiredHours)}</td>
                            <td className="py-4 px-6 text-green-600 font-bold">{decimalHoursToHm(row.totalRegularWorked)}</td>
                            <td className="py-4 px-6 text-blue-600">{decimalHoursToHm(row.totalOvertime)}</td>
                            <td className="py-4 px-6 text-gray-500">{decimalHoursToHm(row.totalActualHours)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            {selectedEmployeeDetails && (
                <Modal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    title={`تفاصيل دوام: ${selectedEmployeeDetails.employeeName}`} 
                    size="xl"
                >
                    <div className="mb-4 grid grid-cols-4 gap-4 text-center bg-gray-50 p-3 rounded-lg border text-sm">
                        <div>
                            <span className="block text-gray-500">إجمالي المقرر</span>
                            <span className="font-bold text-lg">{decimalHoursToHm(selectedEmployeeDetails.totalRequiredHours)}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">إجمالي الأساسي (الفعلي)</span>
                            <span className="font-bold text-lg text-green-600">{decimalHoursToHm(selectedEmployeeDetails.totalRegularWorked)}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">إجمالي الإضافي</span>
                            <span className="font-bold text-lg text-blue-600">{decimalHoursToHm(selectedEmployeeDetails.totalOvertime)}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">العجز (نقص)</span>
                            <span className="font-bold text-lg text-red-600">
                                {decimalHoursToHm(Math.max(0, selectedEmployeeDetails.totalRequiredHours - selectedEmployeeDetails.totalRegularWorked))}
                            </span>
                        </div>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto">
                        <table className="min-w-full text-right text-sm">
                            <thead className="bg-gray-100 sticky top-0">
                                <tr>
                                    <th className="py-2 px-4">التاريخ</th>
                                    <th className="py-2 px-4">اليوم</th>
                                    <th className="py-2 px-4">الحالة</th>
                                    <th className="py-2 px-4">دخول - خروج</th>
                                    <th className="py-2 px-4">المطلوب</th>
                                    <th className="py-2 px-4">الأساسي</th>
                                    <th className="py-2 px-4">الإضافي</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {selectedEmployeeDetails.detailedRecords.map((record, index) => (
                                    <tr key={index} className={record.status === 'غياب' ? 'bg-red-50' : record.status === 'عطلة' ? 'bg-gray-50' : ''}>
                                        <td className="py-3 px-4">{record.date}</td>
                                        <td className="py-3 px-4">{record.dayName}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                record.status === 'حضور' ? 'bg-green-100 text-green-800' :
                                                record.status === 'غياب' ? 'bg-red-100 text-red-800' :
                                                record.status === 'عطلة' ? 'bg-gray-200 text-gray-700' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {record.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 ltr text-right">{record.checkIn} - {record.checkOut}</td>
                                        <td className="py-3 px-4">{decimalHoursToHm(record.required)}</td>
                                        <td className="py-3 px-4 font-bold text-green-700">{decimalHoursToHm(record.regular)}</td>
                                        <td className="py-3 px-4 text-blue-600">{decimalHoursToHm(record.overtime)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                     <div className="flex justify-end gap-3 mt-4 border-t pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إغلاق</button>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default DetailedHoursReport;
