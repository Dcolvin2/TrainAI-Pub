export function tryParseJson<T>(txt: string): T | null {
  try { return JSON.parse(txt) as T; } catch {}
  const m = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m) { try { return JSON.parse(m[1]) as T; } catch {} }
  const start = txt.indexOf('{'), end = txt.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(txt.slice(start, end + 1)) as T; } catch {}
  }
  return null;
}


