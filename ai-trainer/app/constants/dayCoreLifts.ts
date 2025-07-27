export interface DayConfig {
  coreLift?: string;          // optional now
  pattern: 'strength' | 'hiit' | 'cardio';
}

export const dayCoreLifts: Record<number, DayConfig> = {
  1: { coreLift: 'Barbell Back Squat',        pattern: 'strength' }, // Monday
  2: { coreLift: 'Bench Press',               pattern: 'strength' }, // Tuesday
  3: { pattern: 'cardio' },                                       // Wednesday
  4: { pattern: 'hiit' },                                          // Thursday (no core lift)
  5: { pattern: 'cardio' },                                        // Friday
  6: { coreLift: 'Trap-Bar Deadlift',         pattern: 'strength' }, // Saturday
  0: { pattern: 'cardio' }                                         // Sunday
}; 