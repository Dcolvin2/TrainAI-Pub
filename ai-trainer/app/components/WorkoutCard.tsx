'use client';

import React from 'react';

interface WorkoutCardProps {
  type: string;
  primaryMuscles: string;
  accentColor: string;
  onClick: () => void;
}

export function WorkoutCard({ type, primaryMuscles, accentColor, onClick }: WorkoutCardProps) {
  return (
    <button
      onClick={onClick}
      className="relative overflow-hidden rounded-lg bg-gray-800 p-6 transition-all hover:scale-105 hover:bg-gray-700"
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      <h3 className="text-xl font-bold text-white mb-2">{type}</h3>
      <p className="text-sm text-gray-400">{primaryMuscles}</p>
      
      {/* Subtle gradient overlay */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ 
          background: `linear-gradient(135deg, ${accentColor}20 0%, transparent 100%)` 
        }}
      />
    </button>
  );
} 