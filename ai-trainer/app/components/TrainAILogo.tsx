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
    small: 'h-12 w-auto sm:h-14', // 48px on mobile, 56px on desktop
    medium: 'h-16 w-auto sm:h-20', // 64px on mobile, 80px on desktop
    large: 'h-20 w-auto sm:h-24', // 80px on mobile, 96px on desktop
    xl: 'h-24 w-auto sm:h-32' // 96px on mobile, 128px on desktop
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