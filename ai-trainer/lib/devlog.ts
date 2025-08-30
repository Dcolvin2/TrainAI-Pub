// src/lib/devlog.ts
export const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_WORKOUT === '1';

export function devlog(label: string, data: unknown) {
  if (!DEBUG_MODE) return;
  // Keep it JSON-safe and short
  try {
    // eslint-disable-next-line no-console
    console.log(`DBG/${label}`, typeof data === 'string' ? data.slice(0, 2000) : JSON.stringify(data).slice(0, 2000));
  } catch {
    // eslint-disable-next-line no-console
    console.log(`DBG/${label}`, '[unserializable]');
  }
}

