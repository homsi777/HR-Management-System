import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Client, Interest, ClientTask, IElectronAPI, ClientTaskStatus } from '../types';
import Modal from './ui/Modal';
import { ICONS } from '../constants';

// Props
interface ClientsProps {
    clients: Client[];
    interests: Interest[];
    clientTasks: ClientTask[];
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
    api: IElectronAPI;
}

const initialClientData: Omit<Client, 'id'> = {
    name: '',
    phone: '',
    address: '',
    business_field: '',
    interests: [],
    notes: '',
    rating: 0
};

const taskStatusTranslations: Record<ClientTaskStatus, string> = {
    pending: 'قيد الانتظار',
    in_progress: 'قيد التنفيذ',
    done: 'مكتملة',
    cancelled: 'ملغاة'
};

const initialTaskData: Omit<ClientTask, 'id' | 'client_id' | 'created_at' | 'updated_at'> = {
    title: '',
    stage: 1,
    description: '',
    due_date: null,
    reminder_time: null,
    status: 'pending',
};

// Main Component
const Clients: React.FC<ClientsProps> = ({ clients, interests, clientTasks, refreshData, setToast, api }) => {
    // State
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isInterestsModalOpen, setIsInterestsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [formData, setFormData] = useState<Omit<Client, 'id'>>(initialClientData);

    // Task & Task List Modal State
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isTaskListOpen, setIsTaskListOpen] = useState(false);
    const [selectedClientForAction, setSelectedClientForAction] = useState<Client | null>(null);
    const [taskToEdit, setTaskToEdit] = useState<ClientTask | null>(null);

    // Search & Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [filterInterest, setFilterInterest] = useState<'all' | string>('all');

    // Memos
    const filteredClients = useMemo(() => {
        return clients.filter(client => {
            const searchMatch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                client.phone.includes(searchTerm);
            const interestMatch = filterInterest === 'all' || client.interests.includes(filterInterest);
            return searchMatch && interestMatch;
        });
    }, [clients, searchTerm, filterInterest]);

    // Handlers: Client Modal
    const handleOpenClientModal = (client: Client | null = null) => {
        setSelectedClient(client);
        setFormData(client ? client : initialClientData);
        setIsClientModalOpen(true);
    };

    const handleClientFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleInterestsChange = (selectedOptions: string[]) => {
        setFormData(prev => ({...prev, interests: selectedOptions}));
    }
    
    const handleRatingChange = (newRating: number) => {
        setFormData(prev => ({...prev, rating: newRating}));
    }

    const handleClientSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedClient) {
            await api.db.update('clients', selectedClient.id, formData);
            setToast({ message: 'تم تحديث العميل بنجاح.', type: 'success' });
        } else {
            await api.db.insert('clients', formData);
            setToast({ message: 'تمت إضافة العميل بنجاح.', type: 'success' });
        }
        await refreshData();
        setIsClientModalOpen(false);
    };

    const handleDeleteClient = async (id: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذا العميل؟ سيتم حذف جميع المهام المتعلقة به.')) {
            await api.db.delete('clients', id);
            await refreshData();
            setToast({ message: 'تم حذف العميل.', type: 'success' });
        }
    };

    // Handlers: Task & Task List Modals
    const handleOpenAddTask = (client: Client) => {
        setSelectedClientForAction(client);
        setTaskToEdit(null);
        setIsTaskModalOpen(true);
    };

    const handleOpenViewTasks = (client: Client) => {
        setSelectedClientForAction(client);
        setIsTaskListOpen(true);
    };

    const handleEditTask = (task: ClientTask, client: Client) => {
        setIsTaskListOpen(false); // Close the list modal
        setSelectedClientForAction(client);
        setTaskToEdit(task);
        setIsTaskModalOpen(true); // Open the task form modal for editing
    };

    const handleCloseTaskModal = () => {
        setIsTaskModalOpen(false);
        setTaskToEdit(null);
        setSelectedClientForAction(null);
        // If the task list was open before, re-open it
        if (selectedClientForAction) {
            setIsTaskListOpen(true);
        }
    };
    
    const handleCloseTaskListModal = () => {
        setIsTaskListOpen(false);
        setSelectedClientForAction(null);
    }
    
    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-neutral">إدارة العملاء</h2>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsInterestsModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">إدارة الاهتمامات</button>
                    <button onClick={() => handleOpenClientModal()} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition">إضافة عميل جديد</button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-md mb-6 flex items-center gap-4">
                <input
                    type="text"
                    placeholder="بحث بالاسم أو رقم الهاتف..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="p-2 border rounded-lg bg-white w-1/3"
                />
                 <select
                    value={filterInterest}
                    onChange={e => setFilterInterest(e.target.value)}
                    className="p-2 border rounded-lg bg-white w-1/4"
                >
                    <option value="all">كل الاهتمامات</option>
                    {interests.map(interest => (
                        <option key={interest.id} value={interest.title}>{interest.title}</option>
                    ))}
                </select>
            </div>

            {/* Client Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClients.map(client => (
                    <ClientCard 
                        key={client.id}
                        client={client}
                        tasks={clientTasks.filter(t => t.client_id === client.id)}
                        onEdit={handleOpenClientModal}
                        onDelete={handleDeleteClient}
                        onAddTask={handleOpenAddTask}
                        onViewTasks={handleOpenViewTasks}
                    />
                ))}
            </div>

            {filteredClients.length === 0 && (
                <div className="text-center py-20 text-gray-500 bg-white rounded-xl shadow-md">
                    <p>لا يوجد عملاء لعرضهم. {searchTerm || filterInterest !== 'all' ? 'جرّب تعديل الفلاتر.' : 'ابدأ بإضافة عميل جديد.'}</p>
                </div>
            )}
            
            {/* Client Form Modal */}
            <Modal title={selectedClient ? "تعديل بيانات العميل" : "إضافة عميل جديد"} isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} size="large">
                <form onSubmit={handleClientSubmit} className="space-y-4 p-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm">الاسم</label><input name="name" value={formData.name} onChange={handleClientFormChange} className="w-full p-2 border rounded-md" required /></div>
                        <div><label className="block text-sm">الهاتف</label><input name="phone" value={formData.phone} onChange={handleClientFormChange} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm">العنوان</label><input name="address" value={formData.address} onChange={handleClientFormChange} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm">مجال العمل</label><input name="business_field" value={formData.business_field} onChange={handleClientFormChange} className="w-full p-2 border rounded-md" /></div>
                    </div>
                     <div>
                        <label className="block text-sm">الاهتمامات</label>
                        <MultiSelectDropdown options={interests.map(i => i.title)} selected={formData.interests} onChange={handleInterestsChange} />
                    </div>
                    <div><label className="block text-sm">ملاحظات</label><textarea name="notes" value={formData.notes} onChange={handleClientFormChange} rows={3} className="w-full p-2 border rounded-md"></textarea></div>
                    <div>
                        <label className="block text-sm mb-1">التقييم</label>
                        <StarRating rating={formData.rating} onRatingChange={handleRatingChange} />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={() => setIsClientModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-lg">إلغاء</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg">{selectedClient ? 'حفظ' : 'إضافة'}</button>
                    </div>
                </form>
            </Modal>
            
            {/* Interests Management Modal */}
            <InterestsModal isOpen={isInterestsModalOpen} onClose={() => setIsInterestsModalOpen(false)} interests={interests} api={api} refreshData={refreshData} setToast={setToast} />
            
            {/* Task Add/Edit Modal */}
            <TaskModal
                isOpen={isTaskModalOpen}
                onClose={handleCloseTaskModal}
                client={selectedClientForAction}
                taskToEdit={taskToEdit}
                api={api}
                refreshData={refreshData}
                setToast={setToast}
            />
            
            {/* Task List Modal */}
            <TaskListModal
                isOpen={isTaskListOpen}
                onClose={handleCloseTaskListModal}
                client={selectedClientForAction}
                tasks={clientTasks.filter(t => t.client_id === selectedClientForAction?.id)}
                onEditTask={(task) => handleEditTask(task, selectedClientForAction!)}
                api={api}
                refreshData={refreshData}
                setToast={setToast}
            />

        </div>
    );
};

// Sub-components

const ClientCard: React.FC<{
    client: Client, 
    tasks: ClientTask[], 
    onEdit: (client: Client) => void, 
    onDelete: (id: number) => void, 
    onAddTask: (client: Client) => void,
    onViewTasks: (client: Client) => void,
}> = ({ client, tasks, onEdit, onDelete, onAddTask, onViewTasks }) => {
    return (
        <div className="bg-white rounded-xl shadow-md p-4 flex flex-col justify-between transition-shadow hover:shadow-lg">
            <div>
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-lg font-bold text-neutral">{client.name}</h3>
                        <p className="text-sm text-gray-500">{client.business_field}</p>
                    </div>
                     <div className="flex items-center gap-1">
                        <button onClick={() => onEdit(client)} className="p-1 text-gray-400 hover:text-primary">{React.cloneElement(ICONS.edit, {className: "h-5 w-5"})}</button>
                        <button onClick={() => onDelete(client.id)} className="p-1 text-gray-400 hover:text-red-500">{React.cloneElement(ICONS.delete, {className: "h-5 w-5"})}</button>
                    </div>
                </div>
                <div className="text-sm my-3 space-y-1">
                    <p><strong>الهاتف:</strong> {client.phone}</p>
                    <p><strong>العنوان:</strong> {client.address}</p>
                </div>
                <div className="my-3">
                    <h4 className="text-xs font-bold text-gray-500 mb-1">الاهتمامات</h4>
                    <div className="flex flex-wrap gap-1">
                        {client.interests.length > 0 ? client.interests.map(interest => <span key={interest} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">{interest}</span>) : <span className="text-xs text-gray-400">لا يوجد</span>}
                    </div>
                </div>
                <div className="my-3">
                    <h4 className="text-xs font-bold text-gray-500 mb-1">المهام ({tasks.length})</h4>
                     {tasks.length > 0 ? (
                        <ul className="space-y-1 text-xs text-gray-600 list-disc pr-4 max-h-20 overflow-y-auto">
                            {tasks.map(task => (
                                <li key={task.id} title={task.description}>
                                    {task.title} - ({taskStatusTranslations[task.status]})
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-gray-400">لا توجد مهام مسجلة.</p>
                    )}
                </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t mt-2">
                 <StarRating rating={client.rating} onRatingChange={() => {}} readonly />
                 <div className="flex items-center gap-2">
                    <button onClick={() => onViewTasks(client)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700">عرض المهام</button>
                    <button onClick={() => onAddTask(client)} className="text-sm bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700">إضافة مهمة</button>
                </div>
            </div>
        </div>
    );
};

const InterestsModal: React.FC<{isOpen: boolean, onClose: () => void, interests: Interest[], api: IElectronAPI, refreshData: () => void, setToast: (t:any)=>void}> = ({isOpen, onClose, interests, api, refreshData, setToast}) => {
    const [newInterest, setNewInterest] = useState('');

    const handleAdd = async () => {
        if (!newInterest.trim()) return;
        try {
            await api.db.insert('interests', { title: newInterest.trim() });
            setNewInterest('');
            await refreshData();
            setToast({message: 'تمت إضافة الاهتمام بنجاح.', type: 'success'});
        } catch (e: any) {
             setToast({message: `فشل: ${e.message}`, type: 'error'});
        }
    }
    
    const handleDelete = async (id: number) => {
        await api.db.delete('interests', id);
        await refreshData();
        setToast({message: 'تم حذف الاهتمام.', type: 'success'});
    }

    return (
        <Modal title="إدارة الاهتمامات" isOpen={isOpen} onClose={onClose}>
            <div className="p-2 space-y-4">
                <div className="flex gap-2"><input value={newInterest} onChange={e => setNewInterest(e.target.value)} placeholder="اكتب اهتمام جديد..." className="w-full p-2 border rounded-md" /><button onClick={handleAdd} className="bg-primary text-white px-4 rounded-lg">إضافة</button></div>
                <ul className="max-h-60 overflow-y-auto space-y-2 border-t pt-4">
                    {interests.map(i => (
                        <li key={i.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                            <span>{i.title}</span>
                            <button onClick={() => handleDelete(i.id)} className="text-red-500 p-1">{React.cloneElement(ICONS.delete, {className: "h-5 w-5"})}</button>
                        </li>
                    ))}
                </ul>
            </div>
        </Modal>
    );
}

const StarRating: React.FC<{rating: number, onRatingChange: (r: number) => void, readonly?: boolean}> = ({ rating, onRatingChange, readonly }) => {
    return (
        <div className="flex items-center" dir="ltr">
            {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} onClick={() => !readonly && onRatingChange(star)} className={`cursor-pointer text-2xl ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}>
                    ★
                </span>
            ))}
        </div>
    );
}

const MultiSelectDropdown: React.FC<{options: string[], selected: string[], onChange: (s: string[]) => void}> = ({options, selected, onChange}) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref]);

    const handleSelect = (option: string) => {
        const newSelected = selected.includes(option)
            ? selected.filter(item => item !== option)
            : [...selected, option];
        onChange(newSelected);
    };

    return (
        <div className="relative" ref={ref}>
            <div onClick={() => setIsOpen(!isOpen)} className="w-full p-2 border rounded-md bg-white cursor-pointer flex justify-between items-center min-h-[42px]">
                <div className="flex flex-wrap gap-1">
                {selected.length > 0 ? selected.map(item => (
                    <span key={item} className="px-2 py-1 bg-gray-200 text-gray-800 text-sm rounded-full flex items-center">
                        {item}
                        <button onClick={(e) => { e.stopPropagation(); handleSelect(item); }} className="ml-2 text-gray-500 hover:text-gray-800">&times;</button>
                    </span>
                )) : <span className="text-gray-500">اختر الاهتمامات...</span>}
                </div>
                <span className="text-gray-400">▼</span>
            </div>
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {options.map(option => (
                        <label key={option} className="flex items-center p-2 hover:bg-gray-100 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selected.includes(option)}
                                onChange={() => handleSelect(option)}
                                className="ml-2"
                            />
                            {option}
                        </label>
                    ))}
                </div>
            )}
        </div>
    )
}

const TaskListModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    client: Client | null;
    tasks: ClientTask[];
    onEditTask: (task: ClientTask) => void;
    api: IElectronAPI;
    refreshData: () => Promise<void>;
    setToast: (toast: any) => void;
}> = ({ isOpen, onClose, client, tasks, onEditTask, api, refreshData, setToast }) => {
    
    const handleDeleteTask = async (taskId: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
            await api.db.delete('client_tasks', taskId);
            setToast({ message: 'تم حذف المهمة.', type: 'success' });
            await refreshData();
        }
    };
    
    return (
        <Modal title={`مهام العميل: ${client?.name}`} isOpen={isOpen} onClose={onClose} size="large">
            <div className="p-2">
                {tasks.length > 0 ? (
                    <div className="max-h-[60vh] overflow-y-auto">
                        <table className="min-w-full text-right text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="p-2">العنوان</th>
                                    <th className="p-2">المرحلة</th>
                                    <th className="p-2">الحالة</th>
                                    <th className="p-2">تاريخ الاستحقاق</th>
                                    <th className="p-2">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {tasks.map(task => (
                                    <tr key={task.id}>
                                        <td className="p-2 font-semibold">{task.title}</td>
                                        <td className="p-2">{task.stage}</td>
                                        <td className="p-2">
                                            <span className={`px-2 py-1 text-xs rounded-full ${task.status === 'done' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {taskStatusTranslations[task.status]}
                                            </span>
                                        </td>
                                        <td className="p-2">{task.due_date || '-'}</td>
                                        <td className="p-2 space-x-2 space-x-reverse">
                                            <button onClick={() => onEditTask(task)} className="text-primary hover:text-primary-dark p-1" title="تعديل المهمة">{React.cloneElement(ICONS.edit, {className: "h-5 w-5"})}</button>
                                            <button onClick={() => handleDeleteTask(task.id)} className="text-red-600 hover:text-red-800 p-1" title="حذف المهمة">{React.cloneElement(ICONS.delete, {className: "h-5 w-5"})}</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-center py-10 text-gray-500">لا توجد مهام مسجلة لهذا العميل.</p>
                )}
            </div>
        </Modal>
    );
};

const TaskModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    client: Client | null;
    taskToEdit: ClientTask | null;
    api: IElectronAPI;
    refreshData: () => Promise<void>;
    setToast: (toast: any) => void;
}> = ({ isOpen, onClose, client, taskToEdit, api, refreshData, setToast }) => {
    const [taskFormData, setTaskFormData] = useState<Omit<ClientTask, 'id' | 'client_id' | 'created_at' | 'updated_at'>>(initialTaskData);

    useEffect(() => {
        if (isOpen) {
            if (taskToEdit) {
                setTaskFormData({
                    title: taskToEdit.title,
                    stage: taskToEdit.stage,
                    description: taskToEdit.description,
                    due_date: taskToEdit.due_date,
                    reminder_time: taskToEdit.reminder_time,
                    status: taskToEdit.status,
                });
            } else {
                setTaskFormData(initialTaskData);
            }
        }
    }, [isOpen, taskToEdit]);
    
    const handleTaskChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setTaskFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTaskSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!client) return;

        const dataToSubmit = {
            ...taskFormData,
            stage: Number(taskFormData.stage),
            due_date: taskFormData.due_date || null,
            reminder_time: taskFormData.reminder_time || null,
        };

        if (taskToEdit) {
            await api.db.update('client_tasks', taskToEdit.id, dataToSubmit);
            setToast({ message: 'تم تحديث المهمة بنجاح.', type: 'success' });
        } else {
            await api.db.insert('client_tasks', { ...dataToSubmit, client_id: client.id });
            setToast({ message: 'تمت إضافة المهمة بنجاح.', type: 'success' });
        }
        await refreshData();
        onClose();
    };

    return (
        <Modal title={taskToEdit ? `تعديل مهمة لـ ${client?.name}` : `إضافة مهمة لـ ${client?.name}`} isOpen={isOpen} onClose={onClose}>
            <form onSubmit={handleTaskSubmit} className="space-y-4 p-2">
                <div><label className="block text-sm">عنوان المهمة</label><input name="title" value={taskFormData.title} onChange={handleTaskChange} className="w-full p-2 border rounded-md" required /></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="block text-sm">المرحلة (1-4)</label><input name="stage" type="number" min="1" max="4" value={taskFormData.stage} onChange={handleTaskChange} className="w-full p-2 border rounded-md" /></div>
                    <div><label className="block text-sm">الحالة</label><select name="status" value={taskFormData.status} onChange={handleTaskChange} className="w-full p-2 border rounded-md bg-white">{Object.entries(taskStatusTranslations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div>
                    <div><label className="block text-sm">تاريخ الاستحقاق</label><input name="due_date" type="date" value={taskFormData.due_date || ''} onChange={handleTaskChange} className="w-full p-2 border rounded-md" /></div>
                </div>
                <div><label className="block text-sm">الوصف</label><textarea name="description" value={taskFormData.description} onChange={handleTaskChange} rows={3} className="w-full p-2 border rounded-md"></textarea></div>
                 <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">إلغاء</button>
                    <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg">{taskToEdit ? 'حفظ التعديلات' : 'إضافة مهمة'}</button>
                </div>
            </form>
        </Modal>
    );
};


export default Clients;