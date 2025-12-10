import React from 'react';
import { BlockedBiometricId, IElectronAPI } from '../../types';
import { ICONS } from '../../constants';

interface BlockedIdsSettingsProps {
    blockedIds: BlockedBiometricId[];
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
    api: IElectronAPI;
}

const BlockedIdsSettings: React.FC<BlockedIdsSettingsProps> = ({ blockedIds, refreshData, setToast, api }) => {
    
    const handleUnblock = async (biometricId: string) => {
        if (window.confirm(`هل أنت متأكد من إلغاء حظر المعرّف ${biometricId}؟ سيسمح هذا للنظام باستيراد سجلات الحضور الخاصة به مرة أخرى.`)) {
            try {
                await api.db.delete('blocked_biometric_ids', biometricId);
                await refreshData();
                setToast({ message: 'تم إلغاء حظر المعرّف بنجاح.', type: 'success' });
            } catch (error: any) {
                console.error("Failed to unblock ID:", error);
                setToast({ message: `فشل إلغاء الحظر: ${error.message}`, type: 'error' });
            }
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-xl font-bold text-neutral mb-4">إدارة معرّفات البصمة المحظورة</h3>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-3 rounded-md mb-6 text-sm">
                <p><strong>ملاحظة:</strong> هذه القائمة تحتوي على معرّفات البصمة (Biometric IDs) للموظفين الذين تم إنهاء خدمتهم.</p>
                <p>يقوم النظام بحظر هذه المعرّفات لمنع استيراد أي سجلات حضور قديمة أو جديدة لهم من أجهزة البصمة. يمكنك إلغاء الحظر إذا تم إعادة توظيف الموظف بمعرّف جديد أو عن طريق الخطأ.</p>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-6">المعرّف المحظور</th>
                            <th className="py-3 px-6">السبب</th>
                            <th className="py-3 px-6">تاريخ الحظر</th>
                            <th className="py-3 px-6">إجراء</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {blockedIds.map(blocked => (
                            <tr key={blocked.biometric_id}>
                                <td className="py-4 px-6 font-mono font-semibold">{blocked.biometric_id}</td>
                                <td className="py-4 px-6 text-sm text-gray-600">{blocked.reason}</td>
                                <td className="py-4 px-6 text-sm text-gray-600">{new Date(blocked.created_at).toLocaleString()}</td>
                                <td className="py-4 px-6">
                                    <button 
                                        onClick={() => handleUnblock(blocked.biometric_id)} 
                                        className="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 text-sm transition"
                                    >
                                        إلغاء الحظر
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {blockedIds.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        <p>لا توجد معرّفات محظورة حالياً.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BlockedIdsSettings;