// lib/planNormalize.ts
import type { Plan } from "./planSchema";

// Quick JSON extractor: handles code fences and trailing text
export function tryExtractJson(txt: string): any | null {
  const raw = txt.trim();
  try { return JSON.parse(raw); } catch {}
  const fence = raw.match(/```(?:json)?([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const s = raw.indexOf("{"); const e = raw.lastIndexOf("}");
  if (s >= 0 && e > s) { try { return JSON.parse(raw.slice(s, e + 1)); } catch {} }
  return null;
}

// Coerce numeric strings → numbers, wrap singletons, strip bad items, etc.
export function normalizePlanShape(input: any): Plan {
  const clone = structuredClone(input ?? {});

  const toInt = (v: any) => (typeof v === "string" && /^\d+$/.test(v)) ? parseInt(v, 10) : v;

  if (typeof clone.duration_min !== "number") clone.duration_min = toInt(clone.duration_min) ?? 45;

  if (!Array.isArray(clone.phases)) clone.phases = [];
  clone.phases = clone.phases
    .filter((p: any) => p && typeof p.phase === "string" && Array.isArray(p.items))
    .map((p: any) => ({
      ...p,
      items: (Array.isArray(p.items) ? p.items : [p.items]).filter(Boolean).map((it: any) => {
        const sets = toInt(it?.sets);
        return {
          ...it,
          name: String(it?.name ?? "").trim(),
          sets: sets,
        };
      }).filter((it: any) => it.name),
    }))
    .filter((p: any) => p.items.length > 0);

  // Ensure at least warmup/main/cooldown buckets exist
  const have = new Set(clone.phases.map((p: any) => p.phase));
  const ensure = (phase: string, items: any[]) => {
    if (!have.has(phase)) clone.phases.push({ phase, items });
  };
  ensure("warmup", []);
  ensure("main", []);
  ensure("cooldown", []);

  // If accessory work is inside "main" with isAccessory flag, split it out
  const main = clone.phases.find((p: any) => p.phase === "main");
  if (main) {
    const acc = main.items.filter((it: any) => it.isAccessory);
    if (acc.length) {
      main.items = main.items.filter((it: any) => !it.isAccessory);
      const existingAcc = clone.phases.find((p: any) => p.phase === "accessory");
      if (existingAcc) existingAcc.items.push(...acc);
      else clone.phases.push({ phase: "accessory", items: acc });
    }
  }

  return clone;
}
