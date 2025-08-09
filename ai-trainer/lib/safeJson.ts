export function tryParseJson<T>(txt: string): T | null {
  const clean = txt.trim();
  const fromFence = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? clean;
  const start = fromFence.indexOf('{');
  const end = fromFence.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(fromFence.slice(start, end + 1)) as T; } catch {}
  }
  return null;
}


