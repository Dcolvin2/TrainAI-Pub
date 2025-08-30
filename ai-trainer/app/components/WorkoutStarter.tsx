'use client';

import { useState, useEffect, useMemo } from 'react';
import { planWorkout, type LegacyWorkout } from '@/lib/planWorkout';
import { normalizeWorkout } from '@/utils/normalizeWorkout';
import { getUserEquipment } from '@/lib/getUserEquipment';

interface WorkoutStarterProps {
  userId: string;
  onWorkoutSelected: (workout: any) => void;
}

interface WorkoutTypeCardProps {
  type: string;
  description: string;
  onClick: () => void;
  isSuggested?: boolean;
}

type Split = "push" | "pull" | "legs" | "upper" | "full" | "hiit";

type ApiResp = {
  ok: boolean;
  name: string;
  message: string;
  workout?: any;
  plan?: any;
  debug?: any;
};

function WorkoutTypeCard({ type, description, onClick, isSuggested }: WorkoutTypeCardProps) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'push': return 'bg-red-500/20 border-red-500/30 hover:bg-red-500/30';
      case 'pull': return 'bg-blue-500/20 border-blue-500/30 hover:bg-blue-500/30';
      case 'legs': return 'bg-green-500/20 border-green-500/30 hover:bg-green-500/30';
      case 'full_body': return 'bg-purple-500/20 border-purple-500/30 hover:bg-purple-500/30';
      default: return 'bg-gray-500/20 border-gray-500/30 hover:bg-gray-500/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'push': return '💪';
      case 'pull': return '🏋️';
      case 'legs': return '🦵';
      case 'full_body': return '🔥';
      default: return '⚡';
    }
  };

  return (
    <button
      onClick={onClick}
      className={`p-6 rounded-lg border-2 transition-all duration-200 ${getTypeColor(type)} ${
        isSuggested ? 'ring-2 ring-green-400 ring-opacity-50' : ''
      }`}
    >
      <div className="text-3xl mb-2">{getTypeIcon(type)}</div>
      <div className="text-xl font-bold mb-1 capitalize">
        {type.replace('_', ' ')} Day
      </div>
      <div className="text-sm text-gray-300">{description}</div>
      {isSuggested && (
        <div className="mt-2 text-xs text-green-400 font-medium">
          AI Suggested
        </div>
      )}
    </button>
  );
}

function formatWorkoutType(type: string) {
  return type.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

export default function WorkoutStarter({ userId, onWorkoutSelected }: WorkoutStarterProps) {
  const [suggestedType, setSuggestedType] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<ApiResp | null>(null);

  // Map old workout types to new split system
  const mapWorkoutTypeToSplit = (type: string): Split => {
    switch (type) {
      case 'push': return 'push';
      case 'pull': return 'pull';
      case 'legs': return 'legs';
      case 'full_body': return 'full';
      case 'hiit': return 'hiit';
      case 'upper': return 'upper';
      default: return 'full';
    }
  };

  const startWorkout = async (type: string) => {
    try {
      setLoading(true);
      setError(null);
      setResp(null);
      
      const split = mapWorkoutTypeToSplit(type);
      const minutes = 45; // Default duration, could be made configurable
      
      // Get user equipment
      const equipment = await getUserEquipment(userId);
      
      const payload = { split, minutes, equipment };
      console.log('UI/request', payload);
      
      // Call the new unified chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          split, 
          minutes, 
          equipment 
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const { workout, plan, debug } = data;
      
      // Create response object for debugging
      const apiResp: ApiResp = {
        ok: true,
        name: plan?.name || `${type} Workout`,
        message: data.message || `${type} workout generated`,
        workout,
        plan,
        debug
      };
      
      console.log('UI/response', apiResp);
      
      const normalized = normalizeWorkout(apiResp);
      console.log('UI/normalized', { 
        counts: { 
          w: normalized.warmup.length, 
          m: normalized.main.length, 
          c: normalized.cooldown.length 
        }, 
        sample: normalized.main.slice(0,2) 
      });
      
      setResp(apiResp);
      
      // Transform the workout data to match your existing format
      const transformedWorkout = {
        type: type,
        dayType: type,
        coreLift: workout.main.find((item: any) => !item.isAccessory)?.name || 'Compound Lift',
        warmup: workout.warmup.map((item: any) => item.name),
        workout: workout.main.map((item: any) => item.name),
        cooldown: workout.cooldown.map((item: any) => item.name),
        // Include the new data for future use
        plan,
        message: data.message,
        debug,
        // Legacy format for compatibility
        details: workout.main.map((item: any) => ({
          name: item.name,
          sets: Array.from({ length: parseInt(item.sets || '3') }, (_, i) => ({
            setNumber: i + 1,
            previous: null,
            prescribed: null,
            reps: item.reps || '8-12',
            rest: 60,
            rpe: 8,
          })),
        })),
      };
      
      onWorkoutSelected(transformedWorkout);
    } catch (err: any) {
      setError(err?.message || 'Failed to start workout');
      console.error('Error starting workout:', err);
    } finally {
      setLoading(false);
    }
  };

  const startCustomWorkout = () => {
    // Navigate to custom workout builder
    // This would be implemented based on your routing structure
    console.log('Starting custom workout');
  };

  // Use normalized data for rendering
  const view = useMemo(() => resp ? normalizeWorkout(resp) : null, [resp]);
  const totalItems = (view?.warmup.length ?? 0) + (view?.main.length ?? 0) + (view?.cooldown.length ?? 0);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Generating your workout plan...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button 
          onClick={() => setError(null)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl mb-6 text-center">What are we training today?</h1>
      
      {suggestedType && (
        <div className="mb-6 p-4 bg-green-900/20 rounded-lg border border-green-500/30">
          <p className="text-sm text-green-400 mb-2">Suggested based on your recent training:</p>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-green-400">
                {formatWorkoutType(suggestedType.suggestion)} Day
              </div>
              <div className="text-sm text-green-300">{suggestedType.reason}</div>
            </div>
            <button 
              onClick={() => startWorkout(suggestedType.suggestion)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Start
            </button>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <WorkoutTypeCard 
          type="push" 
          description="Chest, Shoulders, Triceps"
          onClick={() => startWorkout('push')}
          isSuggested={suggestedType?.suggestion === 'push'}
        />
        <WorkoutTypeCard 
          type="pull" 
          description="Back, Biceps"
          onClick={() => startWorkout('pull')}
          isSuggested={suggestedType?.suggestion === 'pull'}
        />
        <WorkoutTypeCard 
          type="legs" 
          description="Quads, Hamstrings, Glutes"
          onClick={() => startWorkout('legs')}
          isSuggested={suggestedType?.suggestion === 'legs'}
        />
        <WorkoutTypeCard 
          type="full_body" 
          description="Complete workout"
          onClick={() => startWorkout('full_body')}
          isSuggested={suggestedType?.suggestion === 'full_body'}
        />
      </div>
      
      {/* Additional workout types */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <WorkoutTypeCard 
          type="hiit" 
          description="High Intensity Intervals"
          onClick={() => startWorkout('hiit')}
          isSuggested={suggestedType?.suggestion === 'hiit'}
        />
        <WorkoutTypeCard 
          type="upper" 
          description="Upper Body Focus"
          onClick={() => startWorkout('upper')}
          isSuggested={suggestedType?.suggestion === 'upper'}
        />
      </div>
      
      {/* Debug Drawer */}
      {resp && (
        <div className="rounded-lg border border-slate-700 p-3 text-xs text-slate-300 mb-4">
          <div><b>{resp.name}</b></div>
          <div>validity: {resp?.debug?.validity ?? 'n/a'} | parseError: {resp?.debug?.parseError ?? 'none'}</div>
          <div>counts → warmup:{view?.warmup.length ?? 0} main:{view?.main.length ?? 0} cooldown:{view?.cooldown.length ?? 0}</div>
          <div>split:{resp?.debug?.split ?? 'n/a'} minutes:{resp?.debug?.minutesRequested ?? 'n/a'}</div>
        </div>
      )}

      {/* Workout render */}
      {view && (
        <section className="rounded-xl bg-slate-900 p-4 mb-4">
          <h3 className="text-slate-100 font-semibold mb-2">Workout</h3>

          {/* Warm-up */}
          {view.warmup.length > 0 && (
            <>
              <h4 className="text-slate-300">Warm-up</h4>
              <ul className="mb-3 list-disc pl-6">
                {view.warmup.map((it, i) => (
                  <li key={`wu-${i}`}>
                    {it.name}
                    {it.sets ? ` – ${it.sets} sets` : ''}
                    {it.reps ? ` x ${it.reps}` : ''}
                    {it.duration_seconds ? ` (${Math.round(it.duration_seconds/60)} min)` : ''}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Main */}
          {view.main.length > 0 && (
            <>
              <h4 className="text-slate-300">Main</h4>
              <ul className="mb-3 list-disc pl-6">
                {view.main.map((it, i) => (
                  <li key={`mn-${i}`}>
                    {it.name}
                    {it.is_main && (
                      <span className="ml-2 px-2 py-0.5 rounded-md bg-emerald-600/20 text-emerald-300 text-xs border border-emerald-700/40">
                        Main Lift
                      </span>
                    )}
                    {it.sets ? ` – ${it.sets} sets` : ''}
                    {it.reps ? ` x ${it.reps}` : ''}
                    {it.duration_seconds ? ` (${Math.round(it.duration_seconds/60)} min)` : ''}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Cooldown */}
          {view.cooldown.length > 0 && (
            <>
              <h4 className="text-slate-300">Cooldown</h4>
              <ul className="mb-3 list-disc pl-6">
                {view.cooldown.map((it, i) => (
                  <li key={`cd-${i}`}>
                    {it.name}
                    {it.duration_seconds ? ` (${Math.round(it.duration_seconds/60)} min)` : ''}
                  </li>
                ))}
              </ul>
            </>
          )}

          {totalItems > 0 ? (
            <button className="btn btn-primary">Start Workout</button>
          ) : (
            <div className="text-red-400 text-sm">No items generated. Check the debug drawer and try again.</div>
          )}
        </section>
      )}
      
      {/* Quick options for other styles */}
      <div className="text-center">
        <button className="text-sm text-gray-400 hover:text-gray-300 transition-colors">
          Switch to: Upper/Lower • Full Body • 5/3/1
        </button>
      </div>
    </div>
  );
} 