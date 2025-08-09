// lib/safeJson.ts
export function tryParseJson<T>(txt: string): T | null {
  const parse = (s: string) => { try { return JSON.parse(s) as T; } catch { return null; } };

  // raw
  const raw = parse(txt);
  if (raw) return raw;

  // fenced
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const f = parse(fence[1]);
    if (f) return f;
  }

  // first {...}
  const start = txt.indexOf('{');
  const end = txt.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return parse(txt.slice(start, end + 1));
  }
  return null;
}


