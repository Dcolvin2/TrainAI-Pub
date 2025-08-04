export const TRAINING_PATTERNS = {
  // Push/Pull/Legs
  PPL: {
    sequence: ['push', 'pull', 'legs', 'push', 'pull', 'legs', 'rest'],
    movements: {
      push: ['Barbell Bench Press', 'Barbell Overhead Press', 'Parallel Bar Dips', 'Dumbbell Flyes'],
      pull: ['Barbell Deadlift', 'Pull-Up', 'Barbell Bent-Over Row', 'Cable Face Pull'],
      legs: ['Barbell Back Squat', 'Barbell Front Squat', 'Walking Lunges', 'Box Step-Up']
    }
  },
  
  // Upper/Lower
  UPPER_LOWER: {
    sequence: ['upper', 'lower', 'rest', 'upper', 'lower', 'rest', 'rest'],
    movements: {
      upper: ['Barbell Bench Press', 'Barbell Overhead Press', 'Barbell Bent-Over Row', 'Pull-Up'],
      lower: ['Barbell Back Squat', 'Barbell Deadlift', 'Barbell Front Squat', 'Barbell Romanian Deadlift']
    }
  },
  
  // Full Body
  FULL_BODY: {
    sequence: ['full', 'rest', 'full', 'rest', 'full', 'rest', 'rest'],
    movements: {
      full: ['Barbell Back Squat', 'Barbell Bench Press', 'Barbell Deadlift', 'Barbell Overhead Press', 'Barbell Bent-Over Row']
    }
  },
  
  // Movement Patterns (Squat/Hinge/Push/Pull)
  MOVEMENT_PATTERNS: {
    sequence: ['squat_push', 'hinge_pull', 'rest', 'squat_push', 'hinge_pull', 'rest', 'rest'],
    movements: {
      squat_push: ['Barbell Back Squat', 'Barbell Bench Press', 'Barbell Overhead Press'],
      hinge_pull: ['Barbell Deadlift', 'Barbell Bent-Over Row', 'Pull-Up']
    }
  }
};

// Map training patterns to core lifts for day determination
export const PATTERN_TO_CORE_LIFT = {
  PPL: {
    push: 'Barbell Bench Press',
    pull: 'Barbell Deadlift', 
    legs: 'Barbell Back Squat',
    rest: 'Rest'
  },
  UPPER_LOWER: {
    upper: 'Barbell Bench Press',
    lower: 'Barbell Back Squat',
    rest: 'Rest'
  },
  FULL_BODY: {
    full: 'Barbell Back Squat', // Default to squat for full body days
    rest: 'Rest'
  },
  MOVEMENT_PATTERNS: {
    squat_push: 'Barbell Back Squat',
    hinge_pull: 'Barbell Deadlift',
    rest: 'Rest'
  }
};

// Type definitions for better type safety
type TrainingPattern = keyof typeof TRAINING_PATTERNS;
type DayType = string;

// Get the appropriate core lift for a given day and training pattern
export function getCoreLiftForDay(day: number, pattern: TrainingPattern): string {
  const patternData = TRAINING_PATTERNS[pattern];
  const dayIndex = day % patternData.sequence.length;
  const dayType = patternData.sequence[dayIndex];
  
  const patternCoreLifts = PATTERN_TO_CORE_LIFT[pattern] as Record<string, string>;
  return patternCoreLifts[dayType] || 'Rest';
}

// Get available training patterns
export function getAvailablePatterns(): string[] {
  return Object.keys(TRAINING_PATTERNS);
}

// Get sequence for a specific pattern
export function getPatternSequence(pattern: TrainingPattern): string[] {
  return TRAINING_PATTERNS[pattern].sequence;
}

// Get movements for a specific day type in a pattern
export function getMovementsForDayType(pattern: TrainingPattern, dayType: string): string[] {
  const patternMovements = TRAINING_PATTERNS[pattern].movements as Record<string, string[]>;
  return patternMovements[dayType] || [];
} 