// lib/intent.ts
export function shouldUseNike(message: string): boolean {
  const m = message.toLowerCase();
  const explicitNike =
    /\b(ntc|nike training club|nike app|nike workout|nike wod)\b/.test(m) ||
    /\bnike\s*#?\s*\d+\b/.test(m) ||
    /\bnike-?workout\b/.test(m);
  // If they mention "style" or a person, prefer AI path
  const styley = /\b(style|in the style of|inspired by|coach|program|custom)\b/.test(m);
  return explicitNike && !styley;
}
