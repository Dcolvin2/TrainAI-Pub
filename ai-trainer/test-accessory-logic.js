// Test script to demonstrate the enhanced accessory exercise logic
const { buildClaudePrompt } = require('./lib/claudeWorkoutPrompt');

// Mock accessory exercises for testing
const mockAccessoryExercises = [
  {
    name: "Dumbbell Bulgarian Split Squat",
    primary_muscle: "quads",
    category: "hypertrophy",
    rest_seconds_default: 150,
    set_duration_seconds: 30,
    instruction: "Rear foot elevated on bench. Squat down on front leg, drive up through heel."
  },
  {
    name: "Barbell Romanian Deadlift",
    primary_muscle: "hamstrings",
    category: "hypertrophy",
    rest_seconds_default: 150,
    set_duration_seconds: 30,
    instruction: "Hold barbell at hip level. Hinge at hips, lower bar along legs."
  },
  {
    name: "Kettlebell Goblet Squat",
    primary_muscle: "quads",
    category: "hypertrophy",
    rest_seconds_default: 150,
    set_duration_seconds: 30,
    instruction: "Hold kettlebell at chest, squat between legs. Keep chest up and core tight."
  },
  {
    name: "Dumbbell Step-Ups",
    primary_muscle: "quads",
    category: "hypertrophy",
    rest_seconds_default: 150,
    set_duration_seconds: 30,
    instruction: "Step up onto box with control. Focus on the working leg."
  }
];

// Test the prompt generation
const prompt = buildClaudePrompt({
  day: "Mon",
  coreLift: "Barbell Back Squat",
  muscleTargets: ["quads", "glutes", "hamstrings"],
  duration: 45,
  equipment: ["Dumbbells", "Barbell", "Kettlebells", "Plyo Box"],
  accessoryExercises: mockAccessoryExercises
});

console.log("=== ENHANCED CLAUDE PROMPT ===");
console.log(prompt);
console.log("\n=== KEY IMPROVEMENTS ===");
console.log("✅ Database provides RECOMMENDED exercises (not restrictive)");
console.log("✅ Claude can suggest BETTER alternatives");
console.log("✅ Equipment awareness maintained");
console.log("✅ Muscle targeting preserved");
console.log("✅ Exercise variety encouraged"); 