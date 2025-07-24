import React from 'react';

interface TrainAILogoProps {
  size?: 'small' | 'medium' | 'large' | 'xl';
  className?: string;
  showText?: boolean;
}

export default function TrainAILogo({ 
  size = 'medium', 
  className = '', 
  showText = false 
}: TrainAILogoProps) {
  const sizeClasses = {
    small: 'w-8 h-8 sm:w-10 sm:h-10',
    medium: 'w-10 h-10 sm:w-12 sm:h-12',
    large: 'w-24 h-24 sm:w-28 sm:h-28',
    xl: 'w-32 h-32 sm:w-40 sm:h-40'
  };

  const logoElement = (
    <img
      src="/Updatedlogo.png"
      alt="TrainAI Logo"
      className={`${sizeClasses[size]} drop-shadow-lg ${className}`}
    />
  );

  if (showText) {
    return (
      <div className="flex items-center space-x-2">
        {logoElement}
        <span className="text-lg font-semibold text-[#22C55E]">TrainAI</span>
      </div>
    );
  }

  return logoElement;
} 