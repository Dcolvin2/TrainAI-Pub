'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Guard from '@/app/components/Guard';

export default function ProfilePage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [currentWeight, setCurrentWeight] = useState<number | ''>('');
  const [goalWeight, setGoalWeight] = useState<number | ''>('');
  const [activeTab, setActiveTab] = useState<'profile' | 'equipment'>('profile');

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
      <div className="max-w-4xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        
        <div className="bg-[#1E293B] p-6 rounded-xl">
          <div className="flex space-x-1 bg-[#0F172A] p-1 rounded-lg mb-6">
            <button 
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                activeTab === 'profile' 
                  ? 'bg-[#1E293B] text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Profile
            </button>
            <button 
              onClick={() => setActiveTab('equipment')}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                activeTab === 'equipment' 
                  ? 'bg-[#1E293B] text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Equipment
            </button>
          </div>
          
          {activeTab === 'profile' && (
            <div>
              {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block font-medium mb-1 text-white">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full border rounded p-2 bg-[#0F172A] text-white border-gray-600"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1 text-white">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full border rounded p-2 bg-[#0F172A] text-white border-gray-600"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1 text-white">Current Weight (lbs)</label>
                  <input
                    type="number"
                    value={currentWeight}
                    onChange={(e) => setCurrentWeight(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full border rounded p-2 bg-[#0F172A] text-white border-gray-600"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1 text-white">Goal Weight (lbs)</label>
                  <input
                    type="number"
                    value={goalWeight}
                    onChange={(e) => setGoalWeight(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full border rounded p-2 bg-[#0F172A] text-white border-gray-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </form>
            </div>
          )}
          
          {activeTab === 'equipment' && (
            <EquipmentSection />
          )}
        </div>
      </div>
    </Guard>
  );
}

// Equipment Section Component
function EquipmentSection() {
  const [master, setMaster] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load master + user rows
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: eqList } = await supabase.from('equipment').select('id,name').order('name');
      setMaster(eqList ?? []);

      const { data: uRows } = await supabase
        .from('user_equipment')
        .select('id,equipment_id,custom_name')
        .eq('user_id', user.id);
      setRows(uRows ?? []);

      // Insert missing rows so every stock item is pre-checked first time
      if (eqList && uRows) {
        const existing = uRows.map((r) => r.equipment_id).filter(Boolean);
        const missing = eqList.filter((e) => !existing.includes(e.id)).map((e) => e.id);
        if (missing.length) {
          const toInsert = missing.map((id) => ({ user_id: user.id, equipment_id: id, custom_name: '' }));
          const { data: inserted } = await supabase
            .from('user_equipment')
            .insert(toInsert)
            .select('id,equipment_id,custom_name');
          if (inserted) setRows((prev) => [...prev, ...inserted]);
        }
      }
    })();
  }, []);

  const toggleStock = async (eid: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const existing = rows.find((r) => r.equipment_id === eid);
    if (existing) {
      await supabase.from('user_equipment').delete().eq('id', existing.id);
      setRows((prev) => prev.filter((r) => r.id !== existing.id));
    } else {
      const { data } = await supabase
        .from('user_equipment')
        .insert({ user_id: user.id, equipment_id: eid, custom_name: '' })
        .select('id,equipment_id,custom_name')
        .single();
      if (data) setRows((prev) => [...prev, data]);
    }
  };

  const addCustom = async () => {
    const name = customInput.trim();
    if (!name) return;
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error: err } = await supabase
      .from('user_equipment')
      .insert({ user_id: user.id, equipment_id: null, custom_name: name })
      .select('id,equipment_id,custom_name')
      .single();
    if (err) setError(err.message);
    if (data) setRows((prev) => [...prev, data]);
    setCustomInput('');
    setLoading(false);
  };

  const removeRow = async (id: string) => {
    await supabase.from('user_equipment').delete().eq('id', id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const isChecked = (eid: string) => !!rows.find((r) => r.equipment_id === eid);

  return (
    <div className="bg-[#1E293B] p-6 rounded-xl">
      <h1 className="text-2xl font-bold mb-6 text-center text-white">Your Equipment</h1>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Stock Equipment Grid */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 tracking-wide text-white">Available Equipment</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {master.map((e) => (
            <label 
              key={e.id} 
              className="flex items-center gap-2 bg-[#0F172A] p-3 rounded-lg shadow-sm hover:bg-[#1C2738] transition-all duration-200 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={isChecked(e.id)}
                onChange={() => toggleStock(e.id)}
                className="w-5 h-5 text-[#22C55E] bg-[#0F172A] border-[#334155] rounded focus:ring-[#22C55E] focus:ring-2"
              />
              <span className="text-sm font-medium text-white">{e.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Custom Equipment Section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4 tracking-wide text-white">Custom Equipment</h2>
        
        {/* Custom Equipment Chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {rows
            .filter((r) => r.equipment_id === null)
            .map((r) => (
              <span
                key={r.id}
                className="px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg flex items-center text-sm text-white"
              >
                {r.custom_name}
                <button
                  type="button"
                  className="ml-2 text-red-400 hover:text-red-300 transition-colors"
                  onClick={() => removeRow(r.id)}
                  aria-label={`Remove ${r.custom_name}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
        </div>

        {/* Add Custom Equipment */}
        <div className="bg-[#0F172A] p-4 rounded-lg border border-[#334155]">
          <div className="flex gap-3">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Add custom equipment"
              className="flex-1 bg-[#0F172A] border border-[#334155] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 transition-all duration-200"
              onKeyPress={(e) => e.key === 'Enter' && addCustom()}
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={loading || !customInput.trim()}
              className="bg-[#22C55E] text-white px-4 py-2 rounded-lg hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
            >
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="text-center text-sm text-gray-400">
        <p>Selected {rows.length} equipment items</p>
      </div>
    </div>
  );
} 