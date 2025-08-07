-- Create view to track exercise rotation patterns
CREATE OR REPLACE VIEW exercise_rotation_stats AS
SELECT 
  exercise_name,
  COUNT(*) as times_used,
  MAX(created_at) as last_used,
  CURRENT_DATE - MAX(created_at::date) as days_since_used
FROM (
  SELECT 
    jsonb_array_elements(planned_exercises->'warmup')->>'name' as exercise_name,
    created_at
  FROM workout_sessions
  WHERE planned_exercises IS NOT NULL
  
  UNION ALL
  
  SELECT 
    jsonb_array_elements(planned_exercises->'main')->>'name' as exercise_name,
    created_at
  FROM workout_sessions
  WHERE planned_exercises IS NOT NULL
  
  UNION ALL
  
  SELECT 
    jsonb_array_elements(planned_exercises->'cooldown')->>'name' as exercise_name,
    created_at
  FROM workout_sessions
  WHERE planned_exercises IS NOT NULL
) AS all_exercises
WHERE exercise_name IS NOT NULL
GROUP BY exercise_name
ORDER BY last_used DESC;

-- Add exercise type column for better classification
ALTER TABLE exercises 
ADD COLUMN IF NOT EXISTS exercise_type text 
  CHECK (exercise_type IN ('main_compound', 'accessory', 'isolation', 'mobility', 'cardio'));

-- Update main compounds
UPDATE exercises 
SET exercise_type = 'main_compound'
WHERE name IN (
  'Barbell Back Squat',
  'Barbell Front Squat',
  'Barbell Deadlift',
  'Trap Bar Deadlift',
  'Barbell Sumo Deadlift',
  'Barbell Bench Press',
  'Dumbbell Bench Press',
  'Barbell Incline Press',
  'Dumbbell Incline Press',
  'Barbell Overhead Press',
  'Dumbbell Shoulder Press'
);

-- Update accessories
UPDATE exercises 
SET exercise_type = 'accessory'
WHERE name IN (
  'Pull-Up',
  'Chin-Up',
  'Barbell Bent-Over Row',
  'Barbell Romanian Deadlift',
  'Dumbbell Single-Arm Row',
  'Dumbbell Bulgarian Split Squat',
  'Cable Row',
  'Lat Pulldown',
  'Dumbbell Flyes',
  'Cable Chest Fly',
  'Dips',
  'Cable Lateral Raise',
  'Dumbbell Lateral Raise',
  'Close-Grip Bench Press',
  'Cable Tricep Pushdown',
  'Overhead Tricep Extension',
  'Face Pulls',
  'Barbell Curl',
  'Dumbbell Hammer Curl',
  'Walking Lunges',
  'Leg Curls',
  'Leg Extensions',
  'Calf Raises',
  'Barbell Hip Thrust',
  'Goblet Squat'
);

-- Update mobility/stretching exercises
UPDATE exercises 
SET exercise_type = 'mobility'
WHERE exercise_phase IN ('warmup', 'cooldown') 
  AND exercise_type IS NULL; 