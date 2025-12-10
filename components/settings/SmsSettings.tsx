import React, { useState, useEffect } from 'react';
import { IElectronAPI } from '../../types';

interface SmsSettingsProps {
    setToast: (toast: { message: string, type: 'success' | 'error' }) => void;
    api: IElectronAPI;
}

const SmsSettings: React.FC<SmsSettingsProps> = ({ setToast, api }) => {
    const [comPort, setComPort] = useState('');
    const [baudRate, setBaudRate] = useState(9600);
    const [availablePorts, setAvailablePorts] = useState<{ path: string }[]>([]);

    useEffect(() => {
        const fetchSettingsAndPorts = async () => {
            const portSetting = await api.db.getSettings('smsComPort');
            if (portSetting && portSetting.value) setComPort(JSON.parse(portSetting.value));
            
            const baudRateSetting = await api.db.getSettings('smsBaudRate');
            if (baudRateSetting && baudRateSetting.value) setBaudRate(JSON.parse(baudRateSetting.value));

            // Reuse scanner's port listing function
            try {
                const ports = await api.scanner.listPorts();
                setAvailablePorts(ports);
            } catch (error) {
                console.error("Failed to list serial ports for SMS settings:", error);
                setToast({ message: 'فشل في جلب قائمة المنافذ المتاحة.', type: 'error' });
            }
        };
        fetchSettingsAndPorts();
    }, [api.db, api.scanner, setToast]);

    const handleSave = async () => {
        if (!comPort) {
            setToast({ message: 'يرجى اختيار منفذ COM.', type: 'error' });
            return;
        }
        await api.db.updateSettings('smsComPort', comPort);
        await api.db.updateSettings('smsBaudRate', baudRate);
        setToast({ message: 'تم حفظ إعدادات بوابة الرسائل بنجاح.', type: 'success' });
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-neutral mb-4">إعدادات بوابة الرسائل (SMS Gateway)</h3>
            <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-800 p-3 rounded-md mb-6 text-sm">
                <strong>ملاحظة:</strong> تتطلب هذه الميزة مودم GSM متصل بالكمبيوتر عبر منفذ USB Serial (COM).
            </div>
            <div className="space-y-4">
                <div>
                    <label htmlFor="smsComPort" className="block text-sm font-medium text-gray-700 mb-1">
                        منفذ COM الخاص بالمودم
                    </label>
                    <select
                        id="smsComPort"
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
                        اختر المنفذ الذي يتصل به مودم الرسائل.
                    </p>
                </div>

                <div>
                    <label htmlFor="smsBaudRate" className="block text-sm font-medium text-gray-700 mb-1">
                       سرعة الاتصال (Baud Rate)
                    </label>
                    <input
                        type="number"
                        id="smsBaudRate"
                        value={baudRate}
                        onChange={(e) => setBaudRate(Number(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                        placeholder="e.g., 9600"
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

export default SmsSettings;