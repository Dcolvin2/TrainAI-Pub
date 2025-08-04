import { getCoreLiftForDay } from './trainingPatterns';

export const coreByDay: Record<number,string> = {
  1: "Barbell Back Squat",
  2: "Barbell Bench Press",
  3: "Cardio",
  4: "HIIT",
  5: "Cardio",
  6: "Trap Bar Deadlift",
  0: "Rest"
};

// String day mapping for user-friendly API calls
export const dayStringMap: Record<string, number> = {
  "sunday": 0,
  "monday": 1,
  "tuesday": 2,
  "wednesday": 3,
  "thursday": 4,
  "friday": 5,
  "saturday": 6,
  "sun": 0,
  "mon": 1,
  "tue": 2,
  "wed": 3,
  "thu": 4,
  "fri": 5,
  "sat": 6
};

// Get core lift with optional training pattern
export function getCoreLift(day: number, trainingPattern?: string): string {
  if (trainingPattern) {
    return getCoreLiftForDay(day, trainingPattern as any);
  }
  return coreByDay[day] || "Rest";
}

export const muscleMap: Record<string,string[]> = {
  "Barbell Back Squat": ["quads","glutes","hamstrings"],
  "Barbell Bench Press": ["chest","triceps","shoulders"],
  "Trap Bar Deadlift": ["glutes","hamstrings","back"],
  "Barbell Deadlift": ["back","glutes","hamstrings"],
  "Barbell Overhead Press": ["shoulders","triceps"],
  "Pull-Up": ["back","biceps"],
  "Barbell Bent-Over Row": ["back","biceps"],
  "Barbell Front Squat": ["quads","glutes","core"],
  "Barbell Romanian Deadlift": ["hamstrings","glutes"],
  "Parallel Bar Dips": ["chest","triceps","shoulders"]
}; 