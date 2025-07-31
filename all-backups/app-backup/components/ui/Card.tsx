import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export default function Card({ 
  children, 
  className = '',
  onClick,
  hover = false
}: CardProps) {
  const baseClasses = 'bg-card border border-border rounded-xl p-6 shadow-lg';
  const hoverClasses = hover ? 'hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer' : '';
  
  return (
    <div 
      className={`${baseClasses} ${hoverClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
} 