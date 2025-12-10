import React, { useState } from 'react';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => void;
  projectName: string;
  projectLogo: string;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, projectName, projectLogo }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(username, password);
    };

  return (
    <div className="flex items-center justify-center min-h-screen bg-transparent p-6 md:p-12">
      <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 w-full max-w-md text-right mb-32">
        <div className="flex justify-start mb-6">
            <img 
                src={projectLogo} 
                alt="شعار المشروع" 
                className="h-24 w-auto object-contain"
                onError={(e) => { (e.target as HTMLImageElement).src = '../img/logo.png'; }}
            />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {projectName}
        </h1>
        <p className="text-sm text-gray-500 mb-8 tracking-widest">
            نظام إدارة الموارد البشرية
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                 <label htmlFor="username" className="block text-right text-sm font-medium text-gray-700 mb-2">اسم المستخدم</label>
                 <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                    required
                 />
            </div>
            <div>
                 <label htmlFor="password"  className="block text-right text-sm font-medium text-gray-700 mb-2">كلمة المرور</label>
                 <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                    required
                 />
            </div>
            <button
                type="submit"
                className="w-full bg-primary text-white font-bold py-3 rounded-lg text-lg hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-dark transition-all duration-300 shadow-lg hover:shadow-xl"
            >
                دخول
            </button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;