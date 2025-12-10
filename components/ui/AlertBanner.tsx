import React from 'react';
import { ICONS } from '../../constants';

interface AlertBannerProps {
  count: number;
  onResolveClick: () => void;
}

const AlertBanner: React.FC<AlertBannerProps> = ({ count, onResolveClick }) => {
  return (
    <div className="bg-orange-100 border-b-4 border-orange-500 text-orange-800 px-4 py-3 shadow-md animate-pulse-slow no-print" role="alert">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="py-1">{React.cloneElement(ICONS.unmatched, { className: "h-6 w-6" })}</div>
          <div className="pr-3">
            <p className="font-bold">تنبيه: توجد سجلات حضور جديدة تحتاج إلى ربط</p>
            <p className="text-sm">لديك {count} بصمة (ID) غير مرتبطة بموظفين. قد يؤدي تجاهلها إلى عدم احتساب الحضور بشكل صحيح.</p>
          </div>
        </div>
        <button
          onClick={onResolveClick}
          className="bg-orange-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors"
        >
          عرض وحل المشكلة
        </button>
      </div>
    </div>
  );
};

export default AlertBanner;
