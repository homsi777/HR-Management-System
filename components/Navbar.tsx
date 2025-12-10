

import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { Page, JobApplication, User, LicenseType } from '../types';
import NotificationBell from './ui/NotificationBell';

interface NavbarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  onOpenAiAssistant: () => void;
  jobApplications: JobApplication[];
  user: User | null;
  projectName: string;
  licenseType: LicenseType;
}

// Helper component for Dropdown Items
const DropdownItem: React.FC<{ 
    page: Page; 
    label: string; 
    isActive: boolean; 
    onClick: () => void 
}> = ({ page, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`block w-full text-right px-4 py-2 text-sm transition-colors hover:bg-gray-50 ${
            isActive ? 'text-primary font-bold bg-primary/5' : 'text-gray-700'
        }`}
    >
        {label}
    </button>
);

const GlobeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m0 18a9 9 0 009-9m-9 9a9 9 0 00-9-9" />
    </svg>
);

const Navbar: React.FC<NavbarProps> = ({ activePage, setActivePage, onOpenAiAssistant, jobApplications, user, projectName, licenseType }) => {
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Defines available pages per license tier
    const getPagesForLicense = (type: LicenseType): Page[] => {
        const lite: Page[] = ['dashboard', 'recruitment', 'employees', 'attendance', 'settings'];
        const pro: Page[] = [...lite, 'payroll', 'leaves', 'reports', 'advances'];
        // Full includes everything
        const full: Page[] = [...pro, 'bonuses', 'custody', 'clients', 'representatives', 'maintenance', 'phoneBook', 'sms', 'manufacturing'];
        
        if (type === 'Lite') return lite;
        if (type === 'Pro') return pro;
        return full; // Full or Trial
    };

    const allowedPages = new Set(getPagesForLicense(licenseType));

    // Define Groups Structure
    const menuGroups = [
        {
            id: 'dashboard_group',
            title: 'الرئيسية',
            type: 'single',
            page: 'dashboard' as Page
        },
        {
            id: 'hr_group',
            title: 'الموارد البشرية',
            type: 'dropdown',
            items: [
                { id: 'employees' as Page, name: 'الموظفين' },
                { id: 'recruitment' as Page, name: 'التوظيف' },
                { id: 'attendance' as Page, name: 'الحضور' },
                { id: 'leaves' as Page, name: 'الإجازات' },
                { id: 'manufacturing' as Page, name: 'موظفين التصنيع' },
                { id: 'representatives' as Page, name: 'المندوبين' },
                { id: 'maintenance' as Page, name: 'فريق الصيانة' },
                { id: 'custody' as Page, name: 'العهد والأمانات' },
            ]
        },
        {
            id: 'finance_group',
            title: 'المالية',
            type: 'dropdown',
            items: [
                { id: 'payroll' as Page, name: 'الرواتب' },
                { id: 'advances' as Page, name: 'السلف' },
                { id: 'bonuses' as Page, name: 'المكافآت والخصومات' },
            ]
        },
        {
            id: 'relations_group',
            title: 'العلاقات',
            type: 'dropdown',
            items: [
                { id: 'clients' as Page, name: 'العملاء' },
                { id: 'phoneBook' as Page, name: 'دفتر الهاتف' },
                { id: 'sms' as Page, name: 'بوابة الرسائل' },
            ]
        },
        {
            id: 'reports_group',
            title: 'التقارير',
            type: 'single',
            page: 'reports' as Page
        },
        {
            id: 'settings_group',
            title: 'الإعدادات',
            type: 'single',
            page: 'settings' as Page
        }
    ];

    // Filter items based on permissions and license
    const getFilteredGroup = (group: any) => {
        if (group.type === 'single') {
            if (!allowedPages.has(group.page)) return null;
            if (user?.role !== 'Admin' && !user?.permissions?.includes(group.page)) return null;
            return group;
        } else {
            const filteredItems = group.items.filter((item: any) => {
                const isAllowedByLicense = allowedPages.has(item.id);
                const isAllowedByUser = user?.role === 'Admin' || user?.permissions?.includes(item.id);
                return isAllowedByLicense && isAllowedByUser;
            });

            if (filteredItems.length === 0) return null;
            return { ...group, items: filteredItems };
        }
    };

    const toggleDropdown = (id: string) => {
        setOpenDropdown(openDropdown === id ? null : id);
    };

    const handleItemClick = (page: Page) => {
        setActivePage(page);
        setOpenDropdown(null);
    };

    return (
        <header className="bg-white shadow-md px-4 sm:px-6 h-[68px] flex justify-between items-center z-20 no-print flex-shrink-0 relative">
            {/* Right side: Logo, Title, and Navigation */}
            <div className="flex items-center gap-6 h-full">
                <div className="flex items-center gap-2">
                    <GlobeIcon />
                    <h1 className="text-xl font-bold text-gray-800 hidden lg:block whitespace-nowrap">{projectName} <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">{licenseType}</span></h1>
                </div>
                
                {/* Navigation Menu */}
                <div className="hidden md:flex items-center gap-2 h-full" ref={dropdownRef}>
                    {menuGroups.map(group => {
                        const filteredGroup = getFilteredGroup(group);
                        if (!filteredGroup) return null;

                        const isGroupActive = filteredGroup.type === 'single' 
                            ? activePage === filteredGroup.page
                            : filteredGroup.items.some((i: any) => i.id === activePage);

                        return (
                            <div key={filteredGroup.id} className="relative h-full flex items-center">
                                {filteredGroup.type === 'single' ? (
                                    <button
                                        onClick={() => handleItemClick(filteredGroup.page)}
                                        className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ease-in-out whitespace-nowrap ${
                                            activePage === filteredGroup.page
                                                ? 'bg-primary/10 text-primary font-bold'
                                                : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                    >
                                        {filteredGroup.title}
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => toggleDropdown(filteredGroup.id)}
                                            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ease-in-out whitespace-nowrap flex items-center gap-1 ${
                                                isGroupActive
                                                    ? 'bg-primary/10 text-primary font-bold'
                                                    : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                        >
                                            {filteredGroup.title}
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${openDropdown === filteredGroup.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        
                                        {openDropdown === filteredGroup.id && (
                                            <div className="absolute top-[50px] right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden animate-fade-in-down">
                                                <div className="py-1">
                                                    {filteredGroup.items.map((item: any) => (
                                                        <DropdownItem 
                                                            key={item.id} 
                                                            page={item.id} 
                                                            label={item.name} 
                                                            isActive={activePage === item.id}
                                                            onClick={() => handleItemClick(item.id)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Left side: Search, AI, and User Profile */}
            <div className="flex items-center gap-4">
                 <button
                    onClick={onOpenAiAssistant}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Open AI Assistant"
                    title="المساعد الذكي"
                >
                    {React.cloneElement(ICONS.ai_assistant, {className: "h-6 w-6 text-primary"})}
                </button>
                <NotificationBell jobApplications={jobApplications} onNavigate={() => setActivePage('recruitment')} />
                <div className="relative hidden lg:block">
                    <input
                        type="text"
                        placeholder="بحث..."
                        className="bg-gray-100 rounded-full py-2 px-4 w-32 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-600 text-sm">
                        {user?.username?.substring(0, 2).toUpperCase() || 'AD'}
                    </div>
                    <div className="hidden lg:block">
                        <p className="font-semibold text-sm text-gray-800">{user?.username || 'مسؤول النظام'}</p>
                        <p className="text-xs text-gray-500">{user?.role || 'Admin'}</p>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Navbar;