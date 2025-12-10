import React, { useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'default' | 'large' | 'xl';
  maximizable?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'default', maximizable = false }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  
  if (!isOpen) return null;

  const sizeClass = 
    size === 'large' ? 'max-w-5xl' : 
    size === 'xl' ? 'max-w-7xl' : 
    'max-w-3xl';

  const dynamicClasses = isMaximized
    ? 'w-screen h-screen max-w-none max-h-none rounded-none m-0'
    : `${sizeClass} m-4 max-h-[90vh]`;
  
  const handleClose = () => {
    setIsMaximized(false); // Reset maximized state when closing
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
      <div className={`bg-white rounded-xl shadow-2xl p-6 w-full text-right flex flex-col transition-all duration-300 ease-in-out ${dynamicClasses}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3 mb-4 flex-shrink-0">
          <h3 className="text-xl font-bold text-neutral">{title}</h3>
          <div className="flex items-center gap-2">
            {maximizable && (
              <button onClick={() => setIsMaximized(!isMaximized)} className="text-gray-400 hover:text-gray-600 p-1" title={isMaximized ? "Restore" : "Maximize"}>
                {isMaximized ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z" /></svg>
                )}
              </button>
            )}
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-grow min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;