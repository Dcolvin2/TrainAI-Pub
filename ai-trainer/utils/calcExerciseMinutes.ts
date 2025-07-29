export function calcExerciseMinutes(
  setDurationSec: number,
  restSec: number,
  sets: number
): number {
  return ((setDurationSec + restSec) * sets) / 60; // minutes
} 