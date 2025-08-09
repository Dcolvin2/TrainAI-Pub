// lib/persona.ts
import Anthropic from '@anthropic-ai/sdk';

export const FALLBACK_STYLES = [
  'Joe Holder (mobility + strength + conditioning)',
  'David Goggins (engine + mental toughness)',
  'Chris Hemsworth (hypertrophy + circuits)',
  'Pavel Tsatsouline (kettlebell strength)',
  'Wendler 5/3/1 (barbell strength)'
];

export function detectPersona(message: string): string | null {
  const m = message.toLowerCase().trim();
  const who = [
    'joe holder','david goggins','chris hemsworth','pavel tsatsouline',
    'rob gronkowski','gronk','chris bumstead','arnold','mark rippetoe'
  ];
  const hit = who.find(n => m.includes(n));
  return hit ?? null;
}

export async function probePersona(anthropic: Anthropic, name: string) {
  const q = `Answer JSON only.
{
  "known": boolean,
  "style_notes": string|null
}
Name: "${name}"`;
  const res = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 180,
    temperature: 0,
    messages: [{ role: 'user', content: q }]
  });
  const block = (res.content as any[]).find(b => (b as any).type === 'text');
  const txt = (block as any)?.text ?? '';
  try {
    const j = JSON.parse(txt) as { known: boolean; style_notes: string | null };
    return { ok: !!j.known, notes: j.style_notes ?? null };
  } catch {
    return { ok: false, notes: null };
  }
}


