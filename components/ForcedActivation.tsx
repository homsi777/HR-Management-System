
import React, { useState } from 'react';
import { IElectronAPI, Governorate } from '../types';

interface ForcedActivationProps {
    api: IElectronAPI;
    setToast: (toast: { message: string, type: 'success' | 'error' }) => void;
    onSuccess: () => void;
}

const governorates: { id: Governorate, name: string }[] = [
    { id: 'Damascus', name: 'دمشق' },
    { id: 'RifDimashq', name: 'ريف دمشق' },
    { id: 'Aleppo', name: 'حلب' },
    { id: 'Homs', name: 'حمص' },
    { id: 'Hama', name: 'حماة' },
    { id: 'Latakia', name: 'اللاذقية' },
    { id: 'Tartus', name: 'طرطوس' },
    { id: 'Idlib', name: 'إدلب' },
    { id: 'Daraa', name: 'درعا' },
    { id: 'Suwayda', name: 'السويداء' },
    { id: 'Quneitra', name: 'القنيطرة' },
    { id: 'DeirEzZor', name: 'دير الزور' },
    { id: 'Hasakah', name: 'الحسكة' },
    { id: 'Raqqa', name: 'الرقة' },
];

const ForcedActivation: React.FC<ForcedActivationProps> = ({ api, setToast, onSuccess }) => {
    const [selectedGovernorate, setSelectedGovernorate] = useState<Governorate | ''>('');
    const [activationCode, setActivationCode] = useState('');

    const handleVerify = async () => {
        if (!activationCode || !selectedGovernorate) {
            setToast({ message: 'يرجى اختيار المحافظة وإدخال رمز التفعيل.', type: 'error' });
            return;
        }

        const prefixMap: Record<string, string> = {
            'Damascus': 'DAM', 'Aleppo': 'ALP', 'Homs': 'HOM', 'Hama': 'HAM',
            'Latakia': 'LAT', 'Tartus': 'TAR', 'Idlib': 'IDL', 'Daraa': 'DAR',
            'Suwayda': 'SUW', 'Quneitra': 'QUN', 'DeirEzZor': 'DEZ', 'Hasakah': 'HAS',
            'Raqqa': 'RAQ', 'RifDimashq': 'RIF'
        };

        if (!activationCode.startsWith(prefixMap[selectedGovernorate])) {
             setToast({ message: `رمز التفعيل غير صالح لمحافظة ${governorates.find(g => g.id === selectedGovernorate)?.name}. يجب أن يبدأ بـ ${prefixMap[selectedGovernorate]}`, type: 'error' });
             return;
        }

        const result = await api.app.verifyActivationCode({ code: activationCode, type: 'Full' }); 
        if (result.success) {
            setToast({ message: result.message, type: 'success' }); 
            setTimeout(() => {
                onSuccess();
            }, 1000);
        } else {
            setToast({ message: 'رمز التفعيل غير صالح.', type: 'error' });
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900 z-[100] flex justify-center items-center p-4 backdrop-blur-sm bg-opacity-95">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 text-center">
                <div className="mb-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">انتهت الفترة التجريبية</h2>
                    <p className="text-gray-600 text-sm">
                        لقد انتهت فترة الـ 4 أيام التجريبية لنسخة HR Full. <br/>
                        يرجى تفعيل البرنامج للمتابعة.
                    </p>
                </div>

                <div className="space-y-4 text-right">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">المحافظة</label>
                        <select 
                            value={selectedGovernorate} 
                            onChange={(e) => setSelectedGovernorate(e.target.value as Governorate)}
                            className="w-full p-3 border rounded-lg bg-white"
                        >
                            <option value="" disabled>-- اختر المحافظة --</option>
                            {governorates.map(gov => (
                                <option key={gov.id} value={gov.id}>{gov.name}</option>
                            ))}
                        </select>
                    </div>

                    {selectedGovernorate && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">مفتاح التفعيل</label>
                            <input 
                                value={activationCode} 
                                onChange={e => setActivationCode(e.target.value)} 
                                className="w-full p-3 border rounded-lg ltr text-left uppercase font-mono" 
                                placeholder="KEY..." 
                            />
                        </div>
                    )}

                    <button 
                        onClick={handleVerify}
                        className="w-full bg-primary text-white py-3 rounded-lg hover:bg-primary-dark font-bold mt-4 shadow-lg"
                    >
                        تفعيل واستئناف العمل
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForcedActivation;
