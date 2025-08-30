import { useMemo } from 'react';
import { normalizeWorkout, WorkoutItem, WorkoutShape } from '@/utils/workoutNormalize';

type Props = {
  apiResponse: any;            // your /api/chat JSON
  title?: string;
};

export default function WorkoutDetail({ apiResponse, title }: Props) {
  const view: WorkoutShape = useMemo(() => normalizeWorkout(apiResponse), [apiResponse]);

  const total =
    (view.warmup?.length ?? 0) +
    (view.main?.length ?? 0) +
    (view.cooldown?.length ?? 0);

  if (!total) {
    return (
      <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 text-slate-300">
        <div className="text-sm">No items generated. Try again.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-slate-100">
          {title ?? apiResponse?.name ?? 'Workout'}
        </h2>
      </header>

      {/* Warm-up */}
      {view.warmup?.length > 0 && (
        <section className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4">
          <h3 className="text-slate-200 font-semibold mb-3">Warm-up</h3>
          <ol className="space-y-2">
            {view.warmup.map((it, idx) => (
              <li key={`wu-${idx}`} className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-slate-200 text-xs">
                  {idx + 1}
                </span>
                <div className="text-slate-200">
                  <div className="font-medium">{it.name}</div>
                  <ItemMeta it={it} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Main */}
      {view.main?.length > 0 && (
        <section className="space-y-4">
          {view.main.map((it, idx) => (
            <ExerciseCard key={`mn-${idx}`} item={it} index={idx + 1} />
          ))}
        </section>
      )}

      {/* Cooldown */}
      {view.cooldown?.length > 0 && (
        <section className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4">
          <h3 className="text-slate-200 font-semibold mb-3">Cooldown</h3>
          <ul className="list-disc pl-6 space-y-1 text-slate-200">
            {view.cooldown.map((it, idx) => (
              <li key={`cd-${idx}`}>
                <span className="font-medium">{it.name}</span>
                <ItemMeta it={it} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ItemMeta({ it }: { it: WorkoutItem }) {
  const bits: string[] = [];
  if (it.sets) bits.push(`${it.sets} sets`);
  if (it.reps) bits.push(`${it.reps} reps`);
  if (it.duration_seconds) bits.push(`${Math.round(it.duration_seconds / 60)} min`);
  return bits.length ? (
    <div className="text-slate-400 text-xs">{bits.join(' • ')}</div>
  ) : null;
}

function ExerciseCard({ item, index }: { item: WorkoutItem; index: number }) {
  const sets = Math.max(3, Number(item.sets ?? 3)); // at least 3 rows so it matches the mock
  const rows = Array.from({ length: sets }, (_, i) => i + 1);

  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-slate-200 text-xs">
            {index}
          </span>
          <h4 className="text-slate-100 font-semibold">{item.name}</h4>
        </div>
        {item.is_main ? (
          <span className="px-2 py-0.5 rounded-md bg-emerald-600/20 text-emerald-300 text-xs border border-emerald-700/40">
            Main Lift
          </span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <div className="grid grid-cols-5 bg-slate-950/60 text-slate-300 text-xs font-medium">
          <CellHeader>Set</CellHeader>
          <CellHeader>Previous</CellHeader>
          <CellHeader>lbs</CellHeader>
          <CellHeader>Reps</CellHeader>
          <CellHeader>Complete</CellHeader>
        </div>

        <div className="divide-y divide-slate-800">
          {rows.map((n) => (
            <div key={n} className="grid grid-cols-5 bg-slate-900/50">
              <Cell>{n}</Cell>
              <CellMuted>N/A</CellMuted>
              <CellInput type="number" placeholder="0" />
              <CellInput type="number" placeholder={String(item.reps ?? 10)} />
              <CellCheckbox />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CellHeader({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-2 border-r border-slate-800">{children}</div>;
}
function Cell({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-2 border-r border-slate-800 text-slate-200">{children}</div>;
}
function CellMuted({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-2 border-r border-slate-800 text-slate-400">{children}</div>;
}
function CellInput({ type, placeholder }: { type: 'number'|'text'; placeholder?: string }) {
  return (
    <div className="px-3 py-1.5 border-r border-slate-800">
      <input
        type={type}
        inputMode={type === 'number' ? 'numeric' : undefined}
        className="w-full rounded-lg bg-slate-950/60 border border-slate-800 px-2 py-1 text-slate-100 text-sm outline-none focus:ring-2 focus:ring-emerald-600/40"
        placeholder={placeholder}
      />
    </div>
  );
}
function CellCheckbox() {
  return (
    <div className="px-3 py-2">
      <input
        type="checkbox"
        className="h-4 w-4 accent-emerald-500 bg-slate-950/60 border-slate-700 rounded"
      />
    </div>
  );
}
