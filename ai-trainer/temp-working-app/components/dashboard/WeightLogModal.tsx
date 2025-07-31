'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface WeightLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWeightLogged: () => void;
  currentWeight?: number;
}

export default function WeightLogModal({ isOpen, onClose, onWeightLogged, currentWeight }: WeightLogModalProps) {
  const [weight, setWeight] = useState(currentWeight?.toString() || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!weight || isNaN(Number(weight))) {
      setError('Please enter a valid weight');
      return;
    }

    const weightValue = Number(weight);
    if (weightValue <= 0 || weightValue > 1000) {
      setError('Please enter a realistic weight between 1-1000 lbs');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Insert into weight_logs
      const { error: logError } = await supabase
        .from('weight_logs')
        .insert({
          user_id: user.id,
          weight: weightValue,
          logged_at: new Date().toISOString()
        });

      if (logError) throw logError;

      // Update profiles.weight
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ weight: weightValue })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Success
      onWeightLogged();
      onClose();
      setWeight('');
    } catch (err) {
      console.error('Error logging weight:', err);
      setError('Failed to log weight. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#1E293B] rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold tracking-wide">Log Your Weight</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="weight" className="block text-sm font-medium mb-2">
              Current Weight (lbs)
            </label>
            <input
              id="weight"
              type="number"
              step="0.1"
              min="1"
              max="1000"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-[#334155] border border-border text-foreground px-4 py-3 rounded-xl font-medium text-base transition-all duration-200 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              placeholder="Enter your weight"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[#334155] hover:bg-[#475569] text-foreground font-medium px-4 py-3 rounded-xl shadow-md transition-all duration-200 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-4 py-3 rounded-xl shadow-md transition-all duration-200 text-sm"
            >
              {loading ? 'Logging...' : 'Log Weight'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 