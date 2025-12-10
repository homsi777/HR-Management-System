


import React, { useState } from 'react';
import { Branch, Department, JobTitle, User, Device, Employee, SyncSchedule, IElectronAPI, PrintSettings, LicenseType, BlockedBiometricId } from '../../types';
import DeviceSettings from './settings/DeviceSettings';
import GeneralSettings from './settings/GeneralSettings';
import BranchSettings from './settings/BranchSettings';
import DepartmentSettings from './settings/DepartmentSettings';
import JobTitleSettings from './settings/JobTitleSettings';
import UserSettings from './settings/UserSettings';
import ActivationSettings from './settings/ActivationSettings';
import ScannerSettings from './settings/ScannerSettings';
import PrintingSettings from './settings/PrintingSettings';
import SmsSettings from './settings/SmsSettings';
import SmsTemplateSettings from './settings/SmsTemplateSettings';
import SupportSettings from './settings/SupportSettings';
import BlockedIdsSettings from './settings/BlockedIdsSettings';

interface SettingsProps {
    devices: Device[];
    branches: Branch[];
    departments: Department[];
    jobTitles: JobTitle[];
    users: User[];
    employees: Employee[];
    syncSchedule: SyncSchedule;
    workdays: number[];
    isActivated: boolean;
    isTrialExpired: boolean;
    trialDaysRemaining: number | null;
    printSettings: PrintSettings | null;
    refreshData: () => Promise<void>;
    setToast: (toast: { message: string, type: 'success' | 'error' }) => void;
    nextSyncTime: string | null;
    api: IElectronAPI;
    licenseType: LicenseType;
    cloudSyncEnabled: boolean;
    blockedIds: BlockedBiometricId[];
}

const Settings: React.FC<SettingsProps> = (props) => {
    const [activeTab, setActiveTab] = useState('devices');
    const { refreshData, setToast, api } = props;

    const tabs = [
        { id: 'devices', name: 'أجهزة البصمة' },
        { id: 'blocked_ids', name: 'المعرّفات المحظورة' },
        { id: 'scanner', name: 'الماسح الضوئي' },
        { id: 'sms_gateway', name: 'بوابة الرسائل' },
        { id: 'sms_templates', name: 'قوالب الرسائل' },
        { id: 'general', name: 'إعدادات عامة' },
        { id: 'printing', name: 'تخصيص طباعة' },
        { id: 'branches', name: 'الفروع' },
        { id: 'departments', name: 'الأقسام' },
        { id: 'jobTitles', name: 'المسميات الوظيفية' },
        { id: 'users', name: 'المستخدمين' },
        { id: 'activation', name: 'التفعيل' },
        { id: 'support', name: 'الدعم الفني' },
    ];

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-neutral mb-6">الإعدادات العامة</h2>
            <div className="flex border-b mb-6 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === tab.id ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {tab.name}
                    </button>
                ))}
            </div>
            <div>
                <div style={{ display: activeTab === 'devices' ? 'block' : 'none' }}>
                    <DeviceSettings devices={props.devices} syncSchedule={props.syncSchedule} nextSyncTime={props.nextSyncTime} refreshData={refreshData} setToast={setToast} api={api} />
                </div>
                <div style={{ display: activeTab === 'blocked_ids' ? 'block' : 'none' }}>
                    <BlockedIdsSettings blockedIds={props.blockedIds} refreshData={refreshData} setToast={setToast} api={api} />
                </div>
                <div style={{ display: activeTab === 'scanner' ? 'block' : 'none' }}>
                     <ScannerSettings refreshData={refreshData} setToast={setToast} api={api} />
                </div>
                 <div style={{ display: activeTab === 'sms_gateway' ? 'block' : 'none' }}>
                    <SmsSettings setToast={setToast} api={api} />
                </div>
                <div style={{ display: activeTab === 'sms_templates' ? 'block' : 'none' }}>
                    <SmsTemplateSettings api={api} setToast={setToast} />
                </div>
                <div style={{ display: activeTab === 'general' ? 'block' : 'none' }}>
                    <GeneralSettings workdays={props.workdays} refreshData={refreshData} setToast={setToast} api={api} cloudSyncEnabled={props.cloudSyncEnabled} />
                </div>
                 <div style={{ display: activeTab === 'printing' ? 'block' : 'none' }}>
                    <PrintingSettings printSettings={props.printSettings} refreshData={refreshData} setToast={setToast} api={api} />
                </div>
                <div style={{ display: activeTab === 'branches' ? 'block' : 'none' }}>
                    <BranchSettings branches={props.branches} employees={props.employees} refreshData={refreshData} api={api} setToast={setToast} />
                </div>
                <div style={{ display: activeTab === 'departments' ? 'block' : 'none' }}>
                    <DepartmentSettings departments={props.departments} branches={props.branches} employees={props.employees} refreshData={refreshData} api={api} setToast={setToast} />
                </div>
                <div style={{ display: activeTab === 'jobTitles' ? 'block' : 'none' }}>
                    <JobTitleSettings jobTitles={props.jobTitles} departments={props.departments} refreshData={refreshData} api={api} setToast={setToast} />
                </div>
                <div style={{ display: activeTab === 'users' ? 'block' : 'none' }}>
                    <UserSettings users={props.users} refreshData={refreshData} api={api} setToast={setToast} />
                </div>
                <div style={{ display: activeTab === 'activation' ? 'block' : 'none' }}>
                    <ActivationSettings 
                        isActivated={props.isActivated} 
                        isTrialExpired={props.isTrialExpired} 
                        trialDaysRemaining={props.trialDaysRemaining} 
                        refreshData={refreshData} 
                        setToast={setToast} 
                        api={api}
                        currentLicense={props.licenseType}
                    />
                </div>
                <div style={{ display: activeTab === 'support' ? 'block' : 'none' }}>
                    <SupportSettings setToast={setToast} />
                </div>
            </div>
        </div>
    );
};

export default Settings;