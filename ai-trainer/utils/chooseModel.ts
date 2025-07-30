export function chooseModel(userInput: string): "gpt-4o-mini" | "gpt-4o" {
  // Heuristics → tweak as you wish
  const q = userInput.toLowerCase();

  const isLong      = q.length > 120;
  const isQuestion  = /how|why|explain|what|tips|form|\?/.test(q);
  const asksForm    = /instruction|how do i|fix my|form|depth/.test(q);
  const isNumeric   = /^[\d,\s]+$/.test(q.trim());              // e.g. 3,5,225
  const isDayPrompt = /(it's|its)\s+(mon|tue|wed|thu|fri|sat|sun)/.test(q);
  const isNike      = /^nike/i.test(q);
  const saysGenerate= /generate workout/i.test(q);

  // MINIs are fine for structured or numeric commands
  if (isNumeric || isDayPrompt || isNike || saysGenerate) return "gpt-4o-mini";

  // If it's a short, direct workout command → still mini
  if (!isLong && !isQuestion && /^swap|add|remove|adjust/.test(q))
    return "gpt-4o-mini";

  // Otherwise default to full GPT-4o for reasoning / instructions
  if (isQuestion || asksForm || isLong) return "gpt-4o";

  // fallback
  return "gpt-4o-mini";
} 