export interface InstructionRequest { 
  exercise: string 
}

const pattern =
  /\b(?:how\s+do\s+i\s+(?:perform|do)\s+|teach\s+me\s+)?(?:the\s+)?([\w\s'-]+?)\s+(?:instructions?|form|tutorial)\b/i;

export const getInstructionRequest = (msg: string): InstructionRequest | null => {
  const m = msg.trim().match(pattern);
  return m ? { exercise: m[1].trim() } : null;
}; 