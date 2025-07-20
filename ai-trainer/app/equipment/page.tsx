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
    <Guard>
      <div className="max-w-xl mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Your Equipment</h1>
        {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

        {/* Stock checklist */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {master.map((e) => (
            <label key={e.id} className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={isChecked(e.id)}
                onChange={() => toggleStock(e.id)}
                className="h-4 w-4"
              />
              <span>{e.name}</span>
            </label>
          ))}
        </div>

        {/* Custom chips */}
        <div className="flex flex-wrap mb-4">
          {rows
            .filter((r) => r.equipment_id === null)
            .map((r) => (
              <span
                key={r.id}
                className="px-2 py-1 bg-gray-200 rounded flex items-center text-sm mr-2 mb-2"
              >
                {r.custom_name}
                <button
                  type="button"
                  className="ml-1 text-red-500"
                  onClick={() => removeRow(r.id)}
                >
                  &times;
                </button>
              </span>
            ))}
        </div>

        {/* Add custom */}
        <div className="flex space-x-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Add custom equipment"
            className="flex-1 border rounded p-2"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded"
          >
            Add
          </button>
        </div>
      </div>
    </Guard>
  );
} 