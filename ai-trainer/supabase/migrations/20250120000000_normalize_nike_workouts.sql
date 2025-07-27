-- Normalize and re-tag Nike workouts for proper warm-up/cool-down recognition
-- A) Trim & InitCap every exercise_type
UPDATE public.nike_workouts
SET exercise_type = INITCAP(TRIM(exercise_type));

-- B) Recompute exercise_phase from exercise_type
UPDATE public.nike_workouts
SET exercise_phase =
  CASE
    WHEN LOWER(exercise_type) LIKE '%warm%'            THEN 'warmup'
    WHEN LOWER(exercise_type) LIKE ANY(
           ARRAY['%cool%', '%mobility%', '%mobility cool%']
         )                                        THEN 'cooldown'
    ELSE 'main'
  END;

-- C) Create a view for clean access
CREATE OR REPLACE VIEW public.vw_clean_nike_workouts AS
SELECT
  workout,
  workout_type,
  sets,
  reps,
  exercise,
  instructions,
  exercise_type,
  exercise_phase
FROM public.nike_workouts; 