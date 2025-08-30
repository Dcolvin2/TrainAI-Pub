export function ordinalToNumber(s: string): number | null {
  const m = s.toLowerCase().match(/\b(1st|first|2nd|second|3rd|third|4th|fourth|5th|fifth|6th|sixth|7th|seventh|8th|eighth|9th|ninth|10th|tenth|\d+)\b/);
  if (!m) return null;
  const t = m[1];
  const map: Record<string, number> = { 
    first:1, '1st':1, 
    second:2, '2nd':2, 
    third:3, '3rd':3, 
    fourth:4, '4th':4, 
    fifth:5, '5th':5, 
    sixth:6, '6th':6, 
    seventh:7, '7th':7, 
    eighth:8, '8th':8, 
    ninth:9, '9th':9, 
    tenth:10, '10th':10 
  };
  return map[t] ?? Number.isFinite(+t) ? +t : null;
}

export function extractNikeHints(text: string): { index?: number; typeHint?: string; keywords: string[] } {
  const s = text.toLowerCase();
  const index = ordinalToNumber(s) ?? undefined;
  const typeMap: Record<string,string> = {
    'upper body':'upper body',
    'lower body':'lower body',
    legs:'lower body',
    push:'push',
    pull:'pull',
    hiit:'hiit',
    strength:'strength',
    power:'power',
    eccentrics:'eccentric',
    eccentric:'eccentric',
  };
  const found = Object.keys(typeMap).filter(k => s.includes(k)).map(k => typeMap[k]);
  return { 
    index, 
    typeHint: found.find(f => ['upper body','lower body','push','pull','hiit','strength','power'].includes(f)), 
    keywords: found 
  };
}
