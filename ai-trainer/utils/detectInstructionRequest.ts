export interface InstructionRequest {
  exercise: string
}

const instrPattern =
  /\b(?:how\s+do\s+i\s+(?:perform|do)\s+|teach\s+me\s+)?(?:the\s+)?([\w\s'-]+?)\s+(?:instructions?|form|tutorial|stretch)\b/i;

export const getInstructionRequest = (msg: string): InstructionRequest | null => {
  const m = msg.trim().match(instrPattern);
  if (!m) return null;
  const raw = m[1].trim();
  // strip any leading "the "
  const cleaned = raw.replace(/^the\s+/i, '').trim();
  return { exercise: cleaned };
}; 