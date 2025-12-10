import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import Modal from './ui/Modal';
import { Employee, AttendanceRecord, LeaveRequest, Department, JobTitle, Branch, SalaryAdvance, Bonus, Deduction } from '../types';
import { ICONS } from '../constants';

interface AiAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    employees: Employee[];
    attendance: AttendanceRecord[];
    leaveRequests: LeaveRequest[];
    departments: Department[];
    jobTitles: JobTitle[];
    branches: Branch[];
    salaryAdvances: SalaryAdvance[];
    bonuses: Bonus[];
    deductions: Deduction[];
}

type Message = {
    role: 'user' | 'model' | 'error';
    content: string;
};

const examplePrompts = [
    "من هم الموظفون الغائبون اليوم؟",
    "اظهر لي سجل حضور الموظف عبدالله الأحمد لهذا الشهر.",
    "كم عدد الموظفين في قسم المبيعات؟",
    "من سيبدأ إجازة في الأسبوع القادم؟"
];

const AiAssistant: React.FC<AiAssistantProps> = ({ isOpen, onClose, ...data }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef<null | HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const dataContext = useMemo(() => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const enrichedEmployees = data.employees.map(emp => ({
                id: emp.id,
                name: emp.name,
                status: emp.status,
                jobTitleName: data.jobTitles.find(j => j.id === emp.jobTitleId)?.name || 'N/A',
                departmentName: data.departments.find(d => d.id === emp.departmentId)?.name || 'N/A',
                branchName: data.branches.find(b => b.id === emp.branchId)?.name || 'N/A',
                hireDate: emp.hireDate
            }));

            const enrichedAttendance = data.attendance.map(att => ({
                employeeName: data.employees.find(e => e.id === att.employeeId)?.name || `ID: ${att.employeeId}`,
                date: att.date,
                checkIn: att.checkIn,
                checkOut: att.checkOut,
            }));
            
            const enrichedLeaves = data.leaveRequests.map(lr => ({...lr, employeeName: data.employees.find(e => e.id === lr.employeeId)?.name || `ID: ${lr.employeeId}`}));

            const enrichedAdvances = data.salaryAdvances.map(adv => ({
                employeeName: data.employees.find(e => e.id === adv.employeeId)?.name || `ID: ${adv.employeeId}`,
                amount: adv.amount,
                currency: adv.currency,
                date: adv.date,
                reason: adv.reason,
                status: adv.status,
            }));

            const enrichedBonuses = data.bonuses.map(bonus => ({
                employeeName: data.employees.find(e => e.id === bonus.employeeId)?.name || `ID: ${bonus.employeeId}`,
                amount: bonus.amount,
                currency: bonus.currency,
                date: bonus.date,
                reason: bonus.reason,
            }));

            const enrichedDeductions = data.deductions.map(deduction => ({
                employeeName: data.employees.find(e => e.id === deduction.employeeId)?.name || `ID: ${deduction.employeeId}`,
                amount: deduction.amount,
                currency: deduction.currency,
                date: deduction.date,
                reason: deduction.reason,
            }));

            const context = {
                currentDate: today,
                employees: enrichedEmployees,
                attendanceRecords: enrichedAttendance,
                leaveRequests: enrichedLeaves,
                salaryAdvances: enrichedAdvances,
                bonuses: enrichedBonuses,
                deductions: enrichedDeductions,
            };
            return JSON.stringify(context);
        } catch (error) {
            console.error("Error creating data context:", error);
            return "{}";
        }
    }, [data.employees, data.attendance, data.leaveRequests, data.departments, data.jobTitles, data.branches, data.salaryAdvances, data.bonuses, data.deductions]);

    const handleSend = async (prompt?: string) => {
        const currentInput = prompt || input;
        if (!currentInput.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', content: currentInput };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const fullPrompt = `You are an expert HR data analyst for a company. Your name is "مساعد العالمية الذكي" (Alamia AI Assistant). When you refer to yourself, use the name "العالمية".
You will be provided with company data in JSON format.
Your task is to answer user questions based *only* on the provided data.
- The data includes: employees, attendanceRecords, leaveRequests, salaryAdvances, bonuses, and deductions.
- Analyze the data carefully to answer the question.
- When asked about salary records or financial details, use the 'salaryAdvances', 'bonuses', and 'deductions' arrays to list relevant transactions for the employee within a reasonable timeframe (like the current or last month) unless specified otherwise.
- Do not attempt to calculate a final net salary, as you do not have all the calculation rules (like overtime, lateness deductions, etc.). Simply list the financial events you have data for.
- If the data is insufficient to answer the question, state that you don't have enough information. Do not make up facts.
- Present lists or tables in a clear, easy-to-read format. Use Markdown for formatting tables if needed.
- All your responses MUST be in Arabic.
- Keep your answers concise and to the point.
- The current date is provided in the JSON data. Use it for questions related to "today", "this month", etc.

Data:
${dataContext}

Question: ${currentInput}`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
            });

            const modelMessage: Message = { role: 'model', content: response.text };
            setMessages(prev => [...prev, modelMessage]);

        } catch (error: any) {
            console.error("AI Assistant Error:", error);
            let messageContent = 'حدث خطأ أثناء الاتصال بالمساعد الذكي. يرجى المحاولة مرة أخرى.';
            if (error && error.toString().includes('503')) {
                messageContent = 'النموذج مشغول حاليًا أو غير متاح. يرجى المحاولة مرة أخرى بعد قليل.';
            }
            const errorMessage: Message = { role: 'error', content: messageContent };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="مساعد الموارد البشرية الذكي" size="large">
            <div className="flex flex-col h-[70vh]">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="text-center text-gray-500 pt-8">
                            {React.cloneElement(ICONS.ai_assistant, {className: "h-16 w-16 mx-auto text-gray-300"})}
                            <h3 className="text-lg font-semibold mt-4">مرحباً بك في مساعد العالمية الذكي</h3>
                            <p className="text-sm">اطرح سؤالاً حول بيانات الموظفين أو الحضور أو الإجازات.</p>
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                {examplePrompts.map(prompt => (
                                    <button 
                                        key={prompt}
                                        onClick={() => handleSend(prompt)}
                                        className="p-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition text-right"
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-xl whitespace-pre-wrap ${
                                msg.role === 'user' ? 'bg-primary text-white' : 
                                msg.role === 'model' ? 'bg-gray-100 text-gray-800' : 
                                'bg-red-100 text-red-700'
                            }`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                             <div className="max-w-[80%] p-3 rounded-xl bg-gray-100 text-gray-800 flex items-center">
                                <span className="animate-pulse">●</span>
                                <span className="animate-pulse delay-150">●</span>
                                <span className="animate-pulse delay-300">●</span>
                             </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
                <div className="p-4 border-t flex items-center gap-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="اسأل عن أي شيء يتعلق ببيانات الموارد البشرية..."
                        rows={1}
                        className="flex-1 p-2 border rounded-lg resize-none"
                        disabled={isLoading}
                    />
                    <button onClick={() => handleSend()} disabled={isLoading || !input.trim()} className="bg-primary text-white p-2 rounded-lg disabled:bg-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default AiAssistant;