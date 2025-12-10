import React from 'react';
import { ICONS } from '../../constants';

interface SupportSettingsProps {
    setToast: (toast: { message: string, type: 'success' | 'error' | 'info' }) => void;
}

const SupportSettings: React.FC<SupportSettingsProps> = ({ setToast }) => {
    const supportInfo = [
        { label: 'العنوان', value: 'سوريا حلب الجميلية' },
        { label: 'رقم الهاتف', value: '0944354691', copyable: true },
        { label: 'تيلغرام', value: '0944354691', copyable: true },
        { label: 'واتس اب', value: '0944354691', copyable: true },
        { label: 'رقم الدعم الفني', value: '0968827578', copyable: true },
        { label: 'الايميل', value: 'msouhip@gmail.com', copyable: true },
        { label: 'ايميل إضافي', value: 'msouhip@hotmail.com', copyable: true }
    ];

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setToast({ message: `تم نسخ: ${text}`, type: 'success' });
        }, (err) => {
            setToast({ message: 'فشل النسخ', type: 'error' });
            console.error('Could not copy text: ', err);
        });
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-neutral mb-4">معلومات الدعم الفني</h3>
            <p className="text-sm text-gray-500 mb-6">
                يمكنك التواصل معنا عبر القنوات التالية للحصول على الدعم أو الاستفسار.
            </p>
            <div className="space-y-4">
                {supportInfo.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                        <span className="font-medium text-gray-700">{item.label}:</span>
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-gray-900 ltr">{item.value}</span>
                            {item.copyable && (
                                <button
                                    onClick={() => handleCopy(item.value)}
                                    className="text-gray-400 hover:text-primary transition-colors"
                                    title={`نسخ ${item.label}`}
                                >
                                    {React.cloneElement(ICONS.copy, { className: "h-5 w-5" })}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SupportSettings;
