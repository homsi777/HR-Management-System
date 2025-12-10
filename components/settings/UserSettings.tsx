import React, { useState } from 'react';
import { User, UserRole, AccountStatus, IElectronAPI, Page } from '../../types';
import Modal from '../ui/Modal';
import { ICONS } from '../../constants';

const userRoleTranslations: Record<UserRole, string> = { 'Admin': 'مسؤول النظام', 'Accountant': 'محاسب', 'HR Officer': 'مسؤول موارد بشرية', 'Supervisor': 'مشرف', 'Employee': 'موظف' };
const accountStatusTranslations: Record<AccountStatus, string> = { 'Active': 'نشط', 'Suspended': 'معلق' };

// FIX: Replaced the deprecated 'transfers' page with the 'bonuses' page to resolve type error and match navigation.
const availablePages: { id: Page, name: string }[] = [
    { id: 'dashboard', name: 'الرئيسية' },
    { id: 'employees', name: 'الموظفين' },
    { id: 'clients', name: 'العملاء' },
    { id: 'representatives', name: 'المندوبين' },
    { id: 'recruitment', name: 'التوظيف' },
    { id: 'attendance', name: 'الحضور' },
    { id: 'leaves', name: 'الإجازات' },
    { id: 'advances', name: 'السلف' },
    { id: 'bonuses', name: 'المكافآت' },
    { id: 'custody', name: 'الأمانات' },
    { id: 'payroll', name: 'الرواتب' },
    { id: 'reports', name: 'التقارير' },
    { id: 'phoneBook', name: 'دفتر الهاتف' },
    { id: 'settings', name: 'الإعدادات' },
];

interface UserSettingsProps {
    users: User[];
    refreshData: () => Promise<void>;
    api: IElectronAPI;
    setToast: (toast: { message: string, type: 'success' | 'error' }) => void;
}

const initialFormData: Omit<User, 'id'> & { password?: string } = { 
    username: '', 
    email: '', 
    role: 'Employee', 
    status: 'Active',
    password: '',
    permissions: []
};

const UserSettings: React.FC<UserSettingsProps> = ({ users, refreshData, api, setToast }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [formData, setFormData] = useState(initialFormData);

    const handleAdd = () => {
        setSelectedUser(null);
        setFormData(initialFormData);
        setIsModalOpen(true);
    };
    
    const handleEdit = (user: User) => {
        setSelectedUser(user);
        setFormData({ ...user, password: '', permissions: user.permissions || [] }); // Clear password for editing
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (id === 1) { alert('لا يمكن حذف حساب المسؤول الرئيسي.'); return; }
        if (window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
            await api.db.delete('users', id);
            await refreshData();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSubmit: any = { ...formData };

        if (!selectedUser && !dataToSubmit.password) {
            alert('كلمة المرور مطلوبة للمستخدم الجديد.');
            return;
        }
        
        // Don't update password if it's empty on edit
        if (selectedUser && !dataToSubmit.password) {
            delete dataToSubmit.password;
        }
        
        // Admin role should grant all permissions
        if (dataToSubmit.role === 'Admin') {
            dataToSubmit.permissions = availablePages.map(p => p.id);
        }

        if (selectedUser) {
            await api.db.update('users', selectedUser.id, dataToSubmit);
            setToast({ message: 'تم تحديث المستخدم بنجاح.', type: 'success' });
        } else {
            await api.db.insert('users', dataToSubmit);
            setToast({ message: 'تمت إضافة المستخدم بنجاح.', type: 'success' });
        }
        
        await refreshData();
        setIsModalOpen(false);
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePermissionChange = (pageId: Page) => {
        setFormData(prev => {
            const currentPermissions = new Set(prev.permissions || []);
            if (currentPermissions.has(pageId)) {
                currentPermissions.delete(pageId);
            } else {
                currentPermissions.add(pageId);
            }
            return { ...prev, permissions: Array.from(currentPermissions) };
        });
    };

    return (
         <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-neutral">إدارة المستخدمين والصلاحيات</h3>
                <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition">إضافة مستخدم جديد</button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6">اسم المستخدم</th>
                            <th className="py-3 px-6">البريد الإلكتروني</th>
                            <th className="py-3 px-6">الدور</th>
                            <th className="py-3 px-6">الحالة</th>
                            <th className="py-3 px-6">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {users.map(user => (
                            <tr key={user.id}>
                                <td className="py-4 px-6">{user.username}</td>
                                <td className="py-4 px-6">{user.email}</td>
                                <td className="py-4 px-6">{userRoleTranslations[user.role]}</td>
                                <td className="py-4 px-6">
                                     <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ user.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' }`}>
                                        {accountStatusTranslations[user.status]}
                                    </span>
                                </td>
                                <td className="py-4 px-6 space-x-2 space-x-reverse">
                                    <button onClick={() => handleEdit(user)} className="text-primary hover:text-primary-dark p-1">{React.cloneElement(ICONS.edit, {className: "h-5 w-5"})}</button>
                                    <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-800 p-1" disabled={user.id === 1}>{React.cloneElement(ICONS.delete, {className: "h-5 w-5"})}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             <Modal title={selectedUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="large">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label>اسم المستخدم</label><input name="username" value={formData.username} onChange={handleChange} className="w-full p-2 border rounded" required /></div>
                        <div><label>البريد الإلكتروني</label><input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded" required /></div>
                        <div>
                            <label>كلمة المرور</label>
                            <input name="password" type="password" value={formData.password} onChange={handleChange} className="w-full p-2 border rounded" placeholder={selectedUser ? 'اتركه فارغاً لعدم التغيير' : ''} required={!selectedUser} />
                        </div>
                         <div><label>الدور (الصلاحية)</label><select name="role" value={formData.role} onChange={handleChange} className="w-full p-2 border rounded bg-white" required>
                            {Object.entries(userRoleTranslations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                        </select></div>
                         <div><label>حالة الحساب</label><select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border rounded bg-white" required>
                            {Object.entries(accountStatusTranslations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                        </select></div>
                    </div>

                    <fieldset className="border rounded-md p-3">
                        <legend className="px-2 text-sm font-semibold">صلاحيات الوصول للأقسام</legend>
                        {formData.role === 'Admin' ? (
                            <div className="p-4 text-center bg-blue-50 text-blue-700 rounded-md">
                                للمسؤول صلاحية وصول كاملة لجميع الأقسام.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-2">
                                {availablePages.map(page => (
                                    <label key={page.id} className="flex items-center space-x-2 space-x-reverse p-2 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-400">
                                        <input
                                            type="checkbox"
                                            checked={(formData.permissions || []).includes(page.id)}
                                            onChange={() => handlePermissionChange(page.id)}
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <span className="text-sm font-medium text-gray-700">{page.name}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </fieldset>


                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">{selectedUser ? 'حفظ' : 'إضافة'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default UserSettings;