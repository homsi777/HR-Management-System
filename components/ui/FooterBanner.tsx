import React from 'react';
import { ServiceStatus, ServiceState } from '../../types';

interface FooterBannerProps {
  daysRemaining: number | null;
  isExpired: boolean;
  onActivate: () => void;
  isActivated: boolean;
  status: ServiceStatus | null;
}

const StatusIndicator: React.FC<{ serviceName: string; state: ServiceState }> = ({ serviceName, state }) => {
  const statusInfo = {
    listening: { color: 'bg-green-400', text: 'تستمع' },
    error: { color: 'bg-red-500', text: 'خطأ' },
    inactive: { color: 'bg-gray-500', text: 'غير نشط' }
  };
  
  const isReceiving = state.activity === 'receiving';
  const currentStatus = statusInfo[state.status];
  
  const displayText = isReceiving ? 'جاري الاستقبال...' : currentStatus.text;
  const dotColor = state.status === 'error' ? statusInfo.error.color : (isReceiving ? 'bg-cyan-400' : currentStatus.color);

  return (
    <div className="flex items-center gap-2" title={state.error || ''}>
      <span>{serviceName} ({state.port}):</span>
      <span className="relative flex h-3 w-3">
          {isReceiving && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>}
          <span className={`relative inline-flex rounded-full h-3 w-3 ${dotColor} border border-gray-900/20`}></span>
      </span>
      <span className="text-xs">{displayText}</span>
    </div>
  );
};


const FooterBanner: React.FC<FooterBannerProps> = ({ daysRemaining, isExpired, onActivate, isActivated, status }) => {
  const bannerText = isExpired
    ? 'الفترة التجريبية انتهت. يرجى تفعيل البرنامج للاستمرار.'
    : (daysRemaining !== null ? `نسخة تجريبية - تبقى ${daysRemaining} يومًا.` : 'البرنامج في وضع الفترة التجريبية.');

  return (
    <footer className="fixed bottom-0 left-0 w-full z-30 no-print">
      {!isActivated && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between text-sm font-semibold">
          <span>{bannerText}</span>
          <button
            onClick={onActivate}
            className="bg-white text-red-600 font-bold py-1 px-4 rounded-md text-xs hover:bg-red-100 transition-colors"
          >
            تفعيل البرنامج
          </button>
        </div>
      )}
       {status && (
            <div className="bg-gray-800 text-white px-4 py-1 flex items-center justify-between text-sm">
                <div className="font-bold">حالة النظام</div>
                <div className="flex items-center gap-6 ltr">
                    <StatusIndicator serviceName="ZK API Service" state={status.apiServer} />
                    <StatusIndicator serviceName="Push Service" state={status.pushService} />
                </div>
            </div>
        )}
    </footer>
  );
};

export default FooterBanner;