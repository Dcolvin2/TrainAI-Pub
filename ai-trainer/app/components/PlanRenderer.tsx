'use client';

type Item = {
  name: string;
  sets?: number | string;
  reps?: string;
  duration?: string;
  instruction?: string;
  isAccessory?: boolean;
};

type Phase = { phase: 'warmup'|'main'|'accessory'|'conditioning'|'cooldown'; items: Item[] };

type Plan = { name: string; duration_min: number; phases: Phase[]; progression_tip?: string };

function setsCount(s?: number | string) {
  if (typeof s === 'number') return s;
  if (!s) return 3;
  const m = String(s).match(/\d+/);
  return m ? parseInt(m[0], 10) : 3;
}

export default function PlanRenderer({ plan }: { plan: Plan }) {
  const warmup = plan.phases.find(p => p.phase==='warmup');
  const main   = plan.phases.find(p => p.phase==='main');
  const accessory = plan.phases.find(p => p.phase==='accessory');
  const cond   = plan.phases.find(p => p.phase==='conditioning');
  const cool   = plan.phases.find(p => p.phase==='cooldown');

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{plan.name} <span className="text-sm opacity-70">(~{plan.duration_min} min)</span></h2>

      {warmup && (
        <section>
          <h3 className="font-semibold mb-2">Warm-up</h3>
          <ol className="space-y-1 list-decimal list-inside">
            {warmup.items.map((it, i) => (
              <li key={i} className="opacity-90">
                {it.name}
                {it.reps ? ` — ${it.reps}` : it.duration ? ` — ${it.duration}` : null}
              </li>
            ))}
          </ol>
        </section>
      )}

      {main?.items.map((it, idx) => (
        <section key={idx} className="rounded-2xl bg-neutral-900/40 p-4 ring-1 ring-white/5">
          <div className="flex items-center gap-3 mb-3">
            <h4 className="font-semibold">{it.name}</h4>
            <span className={`text-xs px-2 py-0.5 rounded ${it.isAccessory ? 'bg-blue-500/15 text-blue-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
              {it.isAccessory ? 'Accessory' : 'Main Lift'}
            </span>
          </div>
          <LiftTable sets={setsCount(it.sets)} reps={it.reps} />
          {it.instruction && <p className="mt-2 text-sm opacity-80">{it.instruction}</p>}
        </section>
      ))}

      {accessory && accessory.items.length > 0 && (
        <section className="space-y-4">
          <h3 className="font-semibold">Accessories</h3>
          {accessory.items.map((it, idx) => (
            <section key={idx} className="rounded-2xl bg-neutral-900/40 p-4 ring-1 ring-white/5">
              <div className="flex items-center gap-3 mb-3">
                <h4 className="font-semibold">{it.name}</h4>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/15 text-blue-300">Accessory</span>
              </div>
              <LiftTable sets={setsCount(it.sets)} reps={it.reps} />
              {it.instruction && <p className="mt-2 text-sm opacity-80">{it.instruction}</p>}
            </section>
          ))}
        </section>
      )}

      {cond && (
        <section>
          <h3 className="font-semibold mb-2">Conditioning</h3>
          <ul className="list-disc list-inside opacity-90">
            {cond.items.map((it, i) => (
              <li key={i}>{it.name} — {it.reps ?? it.duration ?? ''}</li>
            ))}
          </ul>
        </section>
      )}

      {cool && (
        <section>
          <h3 className="font-semibold mb-2">Cooldown</h3>
          <ul className="list-disc list-inside opacity-90">
            {cool.items.map((it, i) => (
              <li key={i}>{it.name} — {it.reps ?? it.duration ?? ''}</li>
            ))}
          </ul>
        </section>
      )}

      {plan.progression_tip && (
        <p className="text-sm italic opacity-80">Progression: {plan.progression_tip}</p>
      )}
    </div>
  );
}

function LiftTable({ sets, reps }: { sets: number; reps?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-white/5">
          <tr>
            <th className="px-3 py-2 text-left">Set</th>
            <th className="px-3 py-2 text-left">Previous</th>
            <th className="px-3 py-2 text-left">lbs</th>
            <th className="px-3 py-2 text-left">Reps</th>
            <th className="px-3 py-2 text-left">Complete</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: sets }).map((_, i) => (
            <tr key={i} className="odd:bg-white/0 even:bg-white/5">
              <td className="px-3 py-2">{i + 1}</td>
              <td className="px-3 py-2 opacity-60">N/A</td>
              <td className="px-3 py-2">
                <input className="w-24 rounded bg-neutral-900/70 px-2 py-1 outline-none ring-1 ring-white/10" type="number" placeholder="0" />
              </td>
              <td className="px-3 py-2">
                <input className="w-24 rounded bg-neutral-900/70 px-2 py-1 outline-none ring-1 ring-white/10" placeholder={reps ?? ''} />
              </td>
              <td className="px-3 py-2">
                <input type="checkbox" className="h-4 w-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
