'use client';

import { useState } from 'react';
import WeightLogModal from './WeightLogModal';
import WeightChart from './WeightChart';

interface WeightProgressWidgetProps {
  profile: {
    weight?: number;
    goal_weight?: number;
  } | null;
  weightLogs: Array<{
    id: string;
    weight: number;
    logged_at: string;
  }>;
  onWeightLogged: () => void;
}

export default function WeightProgressWidget({ profile, weightLogs, onWeightLogged }: WeightProgressWidgetProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Calculate weight progress
  const currentWeight = profile?.weight || 0;
  const goalWeight = profile?.goal_weight || 0;
  const startingWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : currentWeight;

  // Weight change logic
  const delta = startingWeight - currentWeight;
  const goalDelta = startingWeight - goalWeight;
  const percentComplete = goalDelta !== 0 ? (delta / goalDelta) * 100 : 0;
  const remainingWeight = Math.abs(currentWeight - goalWeight);

  // Determine progress bar color
  const getProgressColor = () => {
    if (goalWeight === 0) return 'bg-primary';
    
    const isLosing = goalWeight < startingWeight;
    const isGaining = goalWeight > startingWeight;
    const isMovingTowardGoal = (isLosing && delta > 0) || (isGaining && delta < 0);
    
    return isMovingTowardGoal ? 'bg-green-500' : 'bg-red-500';
  };

  // Get progress message
  const getProgressMessage = () => {
    if (goalWeight === 0) return 'Set a goal weight to track progress';
    if (weightLogs.length === 0) return 'No logs yet — tap above to track your progress';
    
    const direction = goalWeight < startingWeight ? 'lost' : 'gained';
    const remainingDirection = goalWeight < startingWeight ? 'to lose' : 'to gain';
    
    return `You've ${direction} ${Math.abs(delta).toFixed(1)} lbs — ${remainingWeight.toFixed(1)} lbs ${remainingDirection}`;
  };

  return (
    <>
      <div className="bg-[#1E293B] rounded-2xl p-6 shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold tracking-wide">Weight Progress</h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-md transition-all duration-200"
            aria-label="Log your weight"
          >
            Log My Weight
          </button>
        </div>

        {weightLogs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted text-sm mb-4">No logs yet — tap above to track your progress</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-primary hover:bg-primary-hover text-white font-medium px-4 py-2 rounded-xl shadow-md transition-all duration-200 text-sm"
            >
              Start Tracking
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Progress Message */}
            <div className="text-center">
              <p className="text-sm text-muted mb-2">Progress</p>
              <p className="text-base font-medium">{getProgressMessage()}</p>
            </div>

            {/* Current Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-muted text-sm">Current</p>
                <p className="text-lg font-semibold">{currentWeight} lbs</p>
              </div>
              <div className="text-center">
                <p className="text-muted text-sm">Goal</p>
                <p className="text-lg font-semibold">{goalWeight} lbs</p>
              </div>
            </div>

            {/* Progress Bar */}
            {goalWeight > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Progress</span>
                  <span className="font-medium">{Math.abs(percentComplete).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-[#334155] rounded-full h-3">
                  <div 
                    className={`${getProgressColor()} h-3 rounded-full transition-all duration-500`}
                    style={{ 
                      width: `${Math.min(100, Math.max(0, Math.abs(percentComplete)))}%` 
                    }}
                  ></div>
                </div>
              </div>
            )}

            {/* Weight Chart */}
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-3 tracking-wide">Weekly Trend</h3>
              <div className="h-32">
                <WeightChart weightLogs={weightLogs} />
              </div>
            </div>
          </div>
        )}
      </div>

      <WeightLogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onWeightLogged={onWeightLogged}
        currentWeight={currentWeight}
      />
    </>
  );
} 