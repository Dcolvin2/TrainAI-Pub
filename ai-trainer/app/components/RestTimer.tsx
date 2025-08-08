'use client';

import { useState, useEffect, useCallback } from 'react';

interface RestTimerProps {
  defaultRestTime?: number; // in seconds
  onRestComplete?: () => void;
  className?: string;
}

export function RestTimer({ defaultRestTime = 180, onRestComplete, className = '' }: RestTimerProps) {
  const [timeLeft, setTimeLeft] = useState(defaultRestTime);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Preset rest times (in seconds)
  const presetTimes = [
    { label: '30s', value: 30 },
    { label: '1m', value: 60 },
    { label: '2m', value: 120 },
    { label: '3m', value: 180 },
    { label: '5m', value: 300 }
  ];

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsRunning(false);
          setIsComplete(true);
          onRestComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, onRestComplete]);

  const startTimer = useCallback((seconds?: number) => {
    const timeToSet = seconds !== undefined ? seconds : defaultRestTime;
    setTimeLeft(timeToSet);
    setIsRunning(true);
    setIsComplete(false);
  }, [defaultRestTime]);

  const pauseTimer = () => {
    setIsRunning(false);
  };

  const resetTimer = () => {
    setTimeLeft(defaultRestTime);
    setIsRunning(false);
    setIsComplete(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    return ((defaultRestTime - timeLeft) / defaultRestTime) * 100;
  };

  return (
    <div className={`bg-gray-800 rounded-xl p-4 border border-gray-700 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">Rest Timer</h3>
        <div className="flex gap-2">
          {presetTimes.map((preset) => (
            <button
              key={preset.value}
              onClick={() => startTimer(preset.value)}
              disabled={isRunning}
              className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timer Display */}
      <div className="text-center mb-4">
        <div className={`text-4xl font-mono font-bold ${
          isComplete ? 'text-green-400' : 
          timeLeft <= 30 ? 'text-red-400' : 
          timeLeft <= 60 ? 'text-yellow-400' : 
          'text-white'
        }`}>
          {formatTime(timeLeft)}
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
          <div 
            className={`h-2 rounded-full transition-all duration-1000 ${
              isComplete ? 'bg-green-400' : 
              timeLeft <= 30 ? 'bg-red-400' : 
              timeLeft <= 60 ? 'bg-yellow-400' : 
              'bg-blue-400'
            }`}
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-3">
        {!isRunning && timeLeft > 0 && !isComplete && (
          <button
            onClick={() => startTimer()}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            Start Rest
          </button>
        )}
        
        {isRunning && (
          <button
            onClick={pauseTimer}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
          >
            Pause
          </button>
        )}
        
        <button
          onClick={resetTimer}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Completion Message */}
      {isComplete && (
        <div className="mt-3 text-center">
          <div className="text-green-400 font-semibold">Rest Complete!</div>
          <div className="text-gray-400 text-sm">Ready for your next set</div>
        </div>
      )}
    </div>
  );
} 