/* 1️⃣  FIX THE NAME SO IT MATCHES YOUR DB  */
const coreByDay: Record<number, string> = {
  1: "Barbell Back Squat",   // ← exactly as it appears in exercise.name
  2: "Bench Press",
  4: "Trap Bar Deadlift",
  6: "Trap Bar Deadlift"
};

export { coreByDay };

// Helper function to build set data for database insertion
export function buildSet(
  sessionId: string,
  ex: { name: string; sets: number; reps: string },
  setNumber: number,
  isMain = true
) {
  return {
    session_id: sessionId,
    /* 🔁 use the text name column that already exists   */
    exercise_name: ex.name,
    set_number: setNumber,
    prescribed_weight: 0,
    reps: parseInt(ex.reps, 10) || 0,
    rest_seconds: isMain ? 120 : 90
  };
} 