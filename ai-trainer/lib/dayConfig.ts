export const dayConfigs = {
  monday:    { coreLift: 'Barbell Back Squat', pattern: 'strength' },
  tuesday:   { coreLift: 'Bench Press',        pattern: 'strength' },
  wednesday: { pattern: 'cardio' },
  thursday:  { pattern: 'hiit' },                     // NO core lift
  friday:    { pattern: 'cardio' },
  saturday:  { coreLift: 'Trap-Bar Deadlift',  pattern: 'strength' },
  sunday:    { pattern: 'cardio' }
} as const;

export type DayKey = keyof typeof dayConfigs;

// helper
export const getTodayCfg = (): (typeof dayConfigs)[DayKey] => {
  const key = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/New_York' })
    .format(new Date())
    .toLowerCase() as DayKey;          // e.g. 'thursday'
  return dayConfigs[key];
};

// helper to get config for any day
export const getDayCfg = (day: string): (typeof dayConfigs)[DayKey] | null => {
  const dayKey = day.toLowerCase() as DayKey;
  return dayConfigs[dayKey] || null;
}; 