export const coreByDay: Record<number,string> = {
  1: "Barbell Back Squat",
  2: "Barbell Bench Press",
  3: "Cardio",
  4: "HIIT",
  5: "Cardio",
  6: "Trap Bar Deadlift",
  0: "Rest"
};

export const muscleMap: Record<string,string[]> = {
  "Barbell Back Squat": ["quads","glutes","hamstrings"],
  "Barbell Bench Press": ["chest","triceps","shoulders"],
  "Trap Bar Deadlift": ["glutes","hamstrings","back"]
}; 