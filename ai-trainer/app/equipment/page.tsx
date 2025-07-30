'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Guard from '@/app/components/Guard';

interface EquipmentRow {
  id: string;
  equipment_id: string | null;
  custom_name: string;
}

interface EquipmentMaster {
  id: string;
  name: string;
}

export default function EquipmentPage() {
  const [master, setMaster] = useState<EquipmentMaster[]>([]);
  const [rows, setRows] = useState<EquipmentRow[]>([]);
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
        const existing = uRows.map((r: { equipment_id: string | null }) => r.equipment_id).filter(Boolean);
        const missing = eqList.filter((e: { id: string }) => !existing.includes(e.id)).map((e: { id: string }) => e.id);
        if (missing.length) {
          const toInsert = missing.map((id: string) => ({ user_id: user.id, equipment_id: id, custom_name: '' }));
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
    <Guard>
      <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#1E293B] p-6 rounded-xl shadow-md text-white">
            <h1 className="text-2xl font-bold mb-6 text-center">Your Equipment</h1>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
                {error}
              </div>
            )}

            {/* Stock Equipment Grid */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4 tracking-wide">Available Equipment</h2>
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
              <h2 className="text-lg font-semibold mb-4 tracking-wide">Custom Equipment</h2>
              
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
            <div className="text-center text-sm text-muted">
              <p>Selected {rows.length} equipment items</p>
            </div>
          </div>
        </div>
      </div>
    </Guard>
  );
} 