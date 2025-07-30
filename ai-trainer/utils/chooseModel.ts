export function chooseModel(userInput: string): "claude-3-5-sonnet-20241022" | "claude-3-5-sonnet-20241022" {
  // Heuristics → tweak as you wish
  const q = userInput.toLowerCase();

  const isLong      = q.length > 120;
  const isQuestion  = /how|why|explain|what|tips|form|\?/.test(q);
  const asksForm    = /instruction|how do i|fix my|form|depth/.test(q);
  const isNumeric   = /^[\d,\s]+$/.test(q.trim());              // e.g. 3,5,225
  const isDayPrompt = /(it's|its)\s+(mon|tue|wed|thu|fri|sat|sun)/.test(q);
  const isNike      = /^nike/i.test(q);
  const saysGenerate= /generate workout/i.test(q);

  // For now, always use Claude 3.5 Sonnet since we're not doing model switching
  return "claude-3-5-sonnet-20241022";
} 