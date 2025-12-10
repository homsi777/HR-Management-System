import React, { useState, useEffect } from 'react';
import { IElectronAPI } from '../../types';

interface ScannerSettingsProps {
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' }) => void;
    api: IElectronAPI;
}

const ScannerSettings: React.FC<ScannerSettingsProps> = ({ refreshData, setToast, api }) => {
    const [comPort, setComPort] = useState('');
    const [baudRate, setBaudRate] = useState(19200);
    const [availablePorts, setAvailablePorts] = useState<{ path: string }[]>([]);

    useEffect(() => {
        const fetchSettingsAndPorts = async () => {
            const portSetting = await api.db.getSettings('scannerComPort');
            if (portSetting) setComPort(JSON.parse(portSetting.value));
            
            const baudRateSetting = await api.db.getSettings('scannerBaudRate');
            if (baudRateSetting) setBaudRate(JSON.parse(baudRateSetting.value));

            const ports = await api.scanner.listPorts();
            setAvailablePorts(ports);
        };
        fetchSettingsAndPorts();
    }, [api.db, api.scanner]);

    const handleSave = async () => {
        if (!comPort) {
            setToast({ message: 'يرجى اختيار منفذ COM.', type: 'error' });
            return;
        }
        await api.db.updateSettings('scannerComPort', comPort);
        await api.db.updateSettings('scannerBaudRate', baudRate);
        await refreshData();
        setToast({ message: 'تم حفظ إعدادات الماسح الضوئي بنجاح.', type: 'success' });
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-neutral mb-4">إعدادات الماسح الضوئي (Scanner)</h3>
            <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-800 p-3 rounded-md mb-6 text-sm">
                <strong>ملاحظة:</strong> هذه الإعدادات مخصصة لماسح الباركود الخاص بالبطاقات الشخصية الذي يعمل بوضع المنفذ التسلسلي (Serial Port).
            </div>
            <div className="space-y-4">
                <div>
                    <label htmlFor="comPort" className="block text-sm font-medium text-gray-700 mb-1">
                        منفذ COM
                    </label>
                    <select
                        id="comPort"
                        value={comPort}
                        onChange={(e) => setComPort(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary bg-white"
                    >
                        <option value="">-- اختر منفذ --</option>
                        {availablePorts.map(port => (
                            <option key={port.path} value={port.path}>{port.path}</option>
                        ))}
                    </select>
                     <p className="text-xs text-gray-500 mt-1">
                        اختر المنفذ الذي يتصل به الماسح الضوئي. يمكنك العثور عليه في "إدارة الأجهزة" (Device Manager) في ويندوز.
                    </p>
                </div>

                <div>
                    <label htmlFor="baudRate" className="block text-sm font-medium text-gray-700 mb-1">
                       سرعة الاتصال (Baud Rate)
                    </label>
                    <input
                        type="number"
                        id="baudRate"
                        value={baudRate}
                        onChange={(e) => setBaudRate(Number(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                        placeholder="e.g., 19200"
                    />
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleSave}
                        className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors duration-200"
                    >
                        حفظ الإعدادات
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScannerSettings;