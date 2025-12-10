import React from 'react';
import { Client, ClientTask, ClientTaskStatus } from '../../types';

interface ClientsReportProps {
    clients: Client[];
    clientTasks: ClientTask[];
    selectedClientId: 'all' | number;
    startDate: string;
    endDate: string;
}

const statusTranslations: Record<ClientTaskStatus, string> = {
    pending: 'قيد الانتظار',
    in_progress: 'قيد التنفيذ',
    done: 'مكتملة',
    cancelled: 'ملغاة'
};

const ClientsReport: React.FC<ClientsReportProps> = ({ clients, clientTasks, selectedClientId, startDate, endDate }) => {
    
    const filteredClients = clients.filter(client => 
        selectedClientId === 'all' || client.id === selectedClientId
    );

    if (filteredClients.length === 0) {
        return <div className="p-10 text-center text-gray-500">لا يوجد عملاء لعرضهم.</div>;
    }

    return (
        <div className="p-4 space-y-6">
            {filteredClients.map(client => {
                const tasksForClient = clientTasks.filter(task => 
                    task.client_id === client.id &&
                    (task.created_at && (task.created_at.split(' ')[0] >= startDate && task.created_at.split(' ')[0] <= endDate))
                );

                return (
                    <div key={client.id} className="p-4 border rounded-lg bg-white shadow-sm break-inside-avoid">
                        <h3 className="text-xl font-bold text-neutral border-b pb-2 mb-3">{client.name}</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                            <p><strong>الهاتف:</strong> {client.phone}</p>
                            <p><strong>العنوان:</strong> {client.address}</p>
                            <p><strong>مجال العمل:</strong> {client.business_field}</p>
                            <p><strong>التقييم:</strong> {'⭐'.repeat(client.rating)}{'☆'.repeat(5 - client.rating)}</p>
                            <div className="col-span-2">
                                <strong>الاهتمامات:</strong>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {client.interests.map(interest => (
                                        <span key={interest} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">{interest}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="col-span-2">
                                <strong>ملاحظات:</strong>
                                <p className="text-gray-700 whitespace-pre-wrap mt-1">{client.notes || 'لا يوجد'}</p>
                            </div>
                        </div>

                        <h4 className="text-lg font-semibold mt-4 mb-2">المهام في الفترة المحددة</h4>
                        {tasksForClient.length > 0 ? (
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-2">المهمة</th>
                                        <th className="p-2">الحالة</th>
                                        <th className="p-2">تاريخ الاستحقاق</th>
                                        <th className="p-2">الوصف</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {tasksForClient.map(task => (
                                        <tr key={task.id}>
                                            <td className="p-2">{task.title} (المرحلة {task.stage})</td>
                                            <td className="p-2">{statusTranslations[task.status]}</td>
                                            <td className="p-2">{task.due_date || '-'}</td>
                                            <td className="p-2">{task.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-gray-500">لا توجد مهام مسجلة لهذا العميل في الفترة المحددة.</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ClientsReport;
