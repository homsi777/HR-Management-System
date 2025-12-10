import React from 'react';

interface SplashScreenProps {
  onStart: () => void;
  projectName: string;
  projectLogo: string;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onStart, projectName, projectLogo }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent p-6 text-center text-gray-800">
      <div className="mb-8">
         <img 
            src={projectLogo} 
            alt="شعار المشروع" 
            className="h-28 w-auto object-contain"
            onError={(e) => { (e.target as HTMLImageElement).src = '../img/logo.png'; }}
         />
      </div>
      <h1 className="text-4xl md:text-5xl font-bold mb-4">
        {`مرحبا بكم في ${projectName}`}
      </h1>
      <p className="text-lg text-gray-500 mb-8">
        نظام متكامل لإدارة الموارد البشرية
      </p>
      <div className="border border-gray-300 rounded-lg py-3 px-6 mb-10 text-gray-600 tracking-wider">
        HR • Cloud Ready • Custom Setup
      </div>
      <button
        onClick={onStart}
        className="bg-primary text-white font-bold py-3 px-16 rounded-lg text-lg hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-dark transition-all duration-300 shadow-lg hover:shadow-xl"
      >
        بدء
      </button>
    </div>
  );
};

export default SplashScreen;