import React, { useState, useMemo } from 'react';
import { JobApplication } from '../../types';
import { ICONS } from '../../constants';

interface NotificationBellProps {
    jobApplications: JobApplication[];
    onNavigate: () => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ jobApplications, onNavigate }) => {
    const [isOpen, setIsOpen] = useState(false);

    const notifications = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const notifs = [];

        const pendingApps = jobApplications.filter(app => app.status === 'Pending');
        if (pendingApps.length > 0) {
            notifs.push({
                id: 'pending_apps',
                type: 'pending',
                message: `لديك ${pendingApps.length} طلبات توظيف جديدة تنتظر المراجعة.`
            });
        }

        const upcomingInterviews = jobApplications.filter(app => 
            app.status === 'Interview' && 
            app.interviewDateTime &&
            app.interviewDateTime.startsWith(todayStr)
        );

        upcomingInterviews.forEach(app => {
            const time = new Date(app.interviewDateTime!).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            notifs.push({
                id: `interview_${app.id}`,
                type: 'interview',
                message: `مقابلة توظيف اليوم مع ${app.fullName} في الساعة ${time}.`
            });
        });

        return notifs;
    }, [jobApplications]);

    const notificationCount = notifications.length;

    const handleBellClick = () => {
        setIsOpen(!isOpen);
    };
    
    const handleNotificationClick = (notification: any) => {
        onNavigate();
        setIsOpen(false);
    }

    return (
        <div className="relative">
            <button
                onClick={handleBellClick}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors relative"
                aria-label="Notifications"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notificationCount > 0 && (
                    <span className="absolute top-0 right-0 block h-2.5 w-2.5 transform -translate-y-1/2 translate-x-1/2 rounded-full bg-red-500 ring-2 ring-white"></span>
                )}
            </button>
            {isOpen && (
                <div className="absolute left-0 mt-2 w-80 bg-white rounded-lg shadow-xl border z-30">
                    <div className="p-3 font-bold border-b">الإشعارات</div>
                    <div className="max-h-80 overflow-y-auto">
                        {notificationCount > 0 ? (
                            notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    onClick={() => handleNotificationClick(notif)}
                                    className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                                >
                                    <p className="text-sm text-gray-700">{notif.message}</p>
                                </div>
                            ))
                        ) : (
                            <p className="p-4 text-sm text-gray-500 text-center">لا توجد إشعارات جديدة.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
