-- Create unified view for warm-up, mobility, and cool-down exercises
CREATE OR REPLACE VIEW public.vw_mobility_warmups AS
SELECT
  id,
  name,
  'nike'            AS source,
  muscle_group      AS primary_muscle,     -- existing column in nike_workouts
  phase             AS exercise_phase,     -- 'warmup' | 'mobility' | 'cooldown'
  instruction
FROM public.nike_workouts
WHERE phase IN ('warmup','mobility','cooldown')

UNION ALL

SELECT
  id,
  name,
  'exercises'       AS source,
  primary_muscle,
  exercise_phase,
  instruction
FROM public.exercises
WHERE exercise_phase IN ('warmup','mobility','cooldown');

-- Enable RLS on the view
ALTER VIEW public.vw_mobility_warmups ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to all users
CREATE POLICY "Allow read access to all users" ON public.vw_mobility_warmups FOR SELECT USING (true); 