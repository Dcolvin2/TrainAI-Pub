'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Guard from '@/app/components/Guard';

interface Equipment {
  id: string;
  name: string;
}

export default function ProfilePage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [currentWeight, setCurrentWeight] = useState<number | ''>('');
  const [goalWeight, setGoalWeight] = useState<number | ''>('');

  // equipment handled in separate page
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch profile
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, current_weight, desired_weight')
        .eq('id', user.id)
        .single();
      if (profile) {
        setFirstName(profile.first_name ?? '');
        setLastName(profile.last_name ?? '');
        setCurrentWeight(profile.current_weight ?? '');
        setGoalWeight(profile.desired_weight ?? '');
      }

      // Equipment handled on /equipment page
    })();
  }, []);

  // Submit profile and equipment
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Upsert profile (id == auth user id)
    const { error: updError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          first_name: firstName,
          last_name: lastName,
          current_weight: currentWeight || null,
          desired_weight: goalWeight || null,
          profile_complete: true,
        },
        { onConflict: 'id' }
      );
    if (updError) {
      setError(updError.message);
      setLoading(false);
      return;
    }

    // nothing to do for equipment here—each toggle/add/delete handled in real time
    setLoading(false);
    router.push('/dashboard');
  }

  return (
    <Guard>
      <div className="max-w-lg mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Complete Your Profile</h1>
        {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block font-medium mb-1">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border rounded p-2"
            />
          </div>

          {/* Goals */}
          <div>
            <h2 className="text-lg font-semibold mb-2">Goals</h2>
            <label className="block mb-1">Current Weight (lbs)</label>
            <input
              type="number"
              value={currentWeight}
              onChange={(e) => setCurrentWeight(e.target.value ? +e.target.value : '')}
              className="w-full border rounded p-2"
            />
            <label className="block mt-4 mb-1">Goal Weight (lbs)</label>
            <input
              type="number"
              value={goalWeight}
              onChange={(e) => setGoalWeight(e.target.value ? +e.target.value : '')}
              className="w-full border rounded p-2"
            />
          </div>

          {/* Equipment section and UI removed */}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded font-semibold"
          >
            {loading ? 'Saving…' : 'Save Profile'}
          </button>
        </form>
      </div>
    </Guard>
  );
} 