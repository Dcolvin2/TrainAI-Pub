export interface QuickEntry {
  setNumber: number;
  reps: number;
  weight: number;
}

const quickEntryPattern = /^\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*(?:;|\n)\s*\d+\s*,\s*\d+\s*,\s*\d+)*\s*$/;

export const isQuickEntry = (msg: string): boolean => quickEntryPattern.test(msg.trim());

export const parseQuickEntry = (msg: string): QuickEntry[] =>
  msg.split(/;|\n/)
     .map(chunk => chunk.trim())
     .filter(Boolean)
     .map(chunk => {
       const [setStr, repsStr, weightStr] = chunk.split(',').map(s => s.trim());
       return {
         setNumber: Number(setStr),
         reps:      Number(repsStr),
         weight:    Number(weightStr)
       };
     }); 