import React from 'react';

interface ReportRow {
    employeeId: number;
    employeeName: string;
    departmentName: string;
    contractStartDate: string;
    contractEndDate: string;
    status: 'ساري' | 'منتهي' | 'على وشك الانتهاء';
    contractFile?: string;
    contractFileName?: string;
    contractFileType?: string;
}

interface EmployeeContractsReportProps {
    data: ReportRow[];
    requestSort: (key: string) => void;
    getSortIndicator: (key: string) => string | null;
}

const EmployeeContractsReport: React.FC<EmployeeContractsReportProps> = ({ data, requestSort, getSortIndicator }) => {
    if (data.length === 0) {
        return <div className="p-10 text-center text-gray-500">لا توجد عقود موظفين لعرضها.</div>;
    }
    
    return (
        <table className="min-w-full text-right">
            <thead className="bg-gray-50">
                <tr>
                    <th className="py-3 px-6"><button onClick={() => requestSort('employeeName')}>الموظف{getSortIndicator('employeeName')}</button></th>
                    <th className="py-3 px-6"><button onClick={() => requestSort('departmentName')}>القسم{getSortIndicator('departmentName')}</button></th>
                    <th className="py-3 px-6"><button onClick={() => requestSort('contractStartDate')}>تاريخ البدء{getSortIndicator('contractStartDate')}</button></th>
                    <th className="py-3 px-6"><button onClick={() => requestSort('contractEndDate')}>تاريخ الانتهاء{getSortIndicator('contractEndDate')}</button></th>
                    <th className="py-3 px-6"><button onClick={() => requestSort('status')}>حالة العقد{getSortIndicator('status')}</button></th>
                    <th className="py-3 px-6">ملف العقد</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
                {data.map((row) => (
                    <tr key={row.employeeId}>
                        <td className="py-4 px-6">{row.employeeName}</td>
                        <td className="py-4 px-6">{row.departmentName}</td>
                        <td className="py-4 px-6">{row.contractStartDate}</td>
                        <td className="py-4 px-6">{row.contractEndDate}</td>
                        <td className="py-4 px-6">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                row.status === 'ساري' ? 'bg-green-100 text-green-800' :
                                row.status === 'منتهي' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                            }`}>
                                {row.status}
                            </span>
                        </td>
                        <td className="py-4 px-6">
                            {row.contractFile && row.contractFileName ? (
                                <a
                                    href={`data:${row.contractFileType};base64,${row.contractFile}`}
                                    download={row.contractFileName}
                                    className="text-blue-600 hover:underline"
                                >
                                    تحميل
                                </a>
                            ) : 'لا يوجد ملف'}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default EmployeeContractsReport;