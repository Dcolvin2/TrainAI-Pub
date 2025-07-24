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

  // Sort weight logs by date (earliest to latest)
  const weightEntries = [...weightLogs].sort((a, b) => 
    new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  );

  // Calculate weight values
  const goalWeight = profile?.goal_weight || null;
  const startingWeight = weightEntries.length > 0 ? weightEntries[0].weight : null;
  const currentWeight = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1].weight : null;

  // Calculate weight change
  const weightLost = startingWeight && currentWeight ? (startingWeight - currentWeight).toFixed(1) : null;
  const weightGained = startingWeight && currentWeight ? (currentWeight - startingWeight).toFixed(1) : null;
  const hasLostWeight = startingWeight && currentWeight && currentWeight < startingWeight;
  const hasGainedWeight = startingWeight && currentWeight && currentWeight > startingWeight;

  // Calculate goal progress
  const goalProgress = startingWeight && goalWeight && currentWeight
    ? Math.min(100, Math.max(0, ((startingWeight - currentWeight) / (startingWeight - goalWeight)) * 100))
    : null;

  // Determine progress bar color
  const getProgressColor = () => {
    if (!goalWeight || !startingWeight || !currentWeight) return 'bg-[#22C55E]';
    
    const isLosing = goalWeight < startingWeight;
    const isGaining = goalWeight > startingWeight;
    const isMovingTowardGoal = (isLosing && hasLostWeight) || (isGaining && hasGainedWeight);
    
    return isMovingTowardGoal ? 'bg-green-500' : 'bg-red-500';
  };

  // Get progress message
  const getProgressMessage = () => {
    if (!goalWeight) return 'Set a goal weight to track progress';
    if (!startingWeight || !currentWeight) return 'No logs yet — tap above to track your progress';
    
    const direction = goalWeight < startingWeight ? 'lost' : 'gained';
    const remainingWeight = Math.abs(currentWeight - goalWeight);
    const remainingDirection = goalWeight < startingWeight ? 'to lose' : 'to gain';
    
    return `${Math.abs(Number(weightLost || weightGained || 0)).toFixed(1)} lbs ${direction} — ${remainingWeight.toFixed(1)} lbs ${remainingDirection}`;
  };

  // Get weight change display text
  const getWeightChangeText = () => {
    if (!startingWeight || !currentWeight) return null;
    
    if (hasLostWeight) {
      return `You've lost ${weightLost} lbs`;
    } else if (hasGainedWeight) {
      return `You've gained ${weightGained} lbs`;
    } else {
      return 'No weight change';
    }
  };

  return (
    <>
      <div className="rounded-xl bg-[#1E293B] p-4 shadow-md w-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold text-white tracking-wide">Weight Progress</h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#22C55E] hover:bg-[#16a34a] text-white text-sm font-semibold px-3 py-2 rounded-lg shadow-md transition-all duration-200"
            aria-label="Log your weight"
          >
            Log My Weight
          </button>
        </div>

        {weightLogs.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted text-sm mb-4">No logs yet — tap above to track your progress</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-[#22C55E] hover:bg-[#16a34a] text-white font-medium px-4 py-2 rounded-lg shadow-md transition-all duration-200 text-sm"
            >
              Start Tracking
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Weight Change Display */}
            {getWeightChangeText() && (
              <div className="text-center">
                <p className="text-sm text-[#22C55E] font-medium">{getWeightChangeText()}</p>
              </div>
            )}

            {/* Current Stats */}
            <div className="flex justify-around text-center text-white">
              <div>
                <p className="text-sm text-muted">Current</p>
                <p className="text-lg font-semibold">{currentWeight || 0} lbs</p>
              </div>
              <div>
                <p className="text-sm text-muted">Goal</p>
                <p className="text-lg font-semibold">{goalWeight || 0} lbs</p>
              </div>
            </div>

            {/* Progress Message */}
            <div className="text-center space-y-2">
              <p className="text-sm text-muted">Progress</p>
              <p className="text-sm font-medium text-white">{getProgressMessage()}</p>
            </div>

            {/* Progress Bar */}
            {goalWeight && goalProgress !== null && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Progress</span>
                  <span className="font-medium text-white">{goalProgress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-[#334155] rounded-full h-2">
                  <div 
                    className={`${getProgressColor()} h-2 rounded-full transition-all duration-500`}
                    style={{ 
                      width: `${goalProgress}%` 
                    }}
                  ></div>
                </div>
              </div>
            )}

            {/* Weight Chart */}
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-white mb-3 tracking-wide">Weekly Trend</h3>
              <div className="w-full h-[200px] overflow-hidden px-4">
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
        currentWeight={currentWeight || undefined}
      />
    </>
  );
} 