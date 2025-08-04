-- New workout types table
CREATE TABLE public.workout_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text NOT NULL,
  target_muscles text[] NOT NULL,
  movement_patterns text[],
  CONSTRAINT workout_types_pkey PRIMARY KEY (id)
);

-- Populate it with workout types
INSERT INTO workout_types (name, category, target_muscles, movement_patterns) VALUES
  ('push', 'split', ARRAY['chest', 'shoulders', 'triceps'], ARRAY['horizontal_push', 'vertical_push']),
  ('pull', 'split', ARRAY['back', 'biceps'], ARRAY['horizontal_pull', 'vertical_pull']),
  ('legs', 'split', ARRAY['quads', 'hamstrings', 'glutes', 'calves'], ARRAY['squat', 'hinge']),
  ('upper', 'split', ARRAY['chest', 'back', 'shoulders', 'biceps', 'triceps'], ARRAY['push', 'pull']),
  ('lower', 'split', ARRAY['quads', 'hamstrings', 'glutes', 'calves'], ARRAY['squat', 'hinge']),
  ('full_body', 'split', ARRAY['all'], ARRAY['all']),
  ('chest', 'muscle_group', ARRAY['chest'], ARRAY['horizontal_push']),
  ('back', 'muscle_group', ARRAY['back'], ARRAY['horizontal_pull', 'vertical_pull']),
  ('shoulders', 'muscle_group', ARRAY['shoulders'], ARRAY['vertical_push']),
  ('arms', 'muscle_group', ARRAY['biceps', 'triceps'], ARRAY['elbow_flexion', 'elbow_extension']),
  ('biceps', 'specific', ARRAY['biceps'], ARRAY['elbow_flexion']),
  ('triceps', 'specific', ARRAY['triceps'], ARRAY['elbow_extension']),
  ('core', 'muscle_group', ARRAY['core'], ARRAY['core']),
  ('glutes', 'specific', ARRAY['glutes'], ARRAY['hinge']),
  ('calves', 'specific', ARRAY['calves'], ARRAY['ankle_extension']);

-- Add workout type tracking to workouts table
ALTER TABLE public.workouts 
ADD COLUMN workout_type_id uuid,
ADD CONSTRAINT workouts_workout_type_fkey 
  FOREIGN KEY (workout_type_id) REFERENCES workout_types(id);

-- Track user patterns
CREATE TABLE public.user_workout_patterns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workout_type text NOT NULL,
  frequency integer DEFAULT 1,
  last_performed date,
  CONSTRAINT user_workout_patterns_pkey PRIMARY KEY (id),
  CONSTRAINT user_workout_patterns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT unique_user_workout_type UNIQUE (user_id, workout_type)
);

-- Add index for performance
CREATE INDEX idx_workouts_workout_type_id ON public.workouts(workout_type_id);
CREATE INDEX idx_user_workout_patterns_user_id ON public.user_workout_patterns(user_id);
CREATE INDEX idx_user_workout_patterns_last_performed ON public.user_workout_patterns(last_performed); 