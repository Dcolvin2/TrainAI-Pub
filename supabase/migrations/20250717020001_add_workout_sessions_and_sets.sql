-- Add workout_sessions and workout_sets tables for the new workout tracking system

-- Workout sessions table
CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_data       JSONB   NOT NULL DEFAULT '{}',
  completed_at       TIMESTAMPTZ,
  total_sets         INT     DEFAULT 0,
  completed_sets     INT     DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- Workout sets table for detailed set tracking
CREATE TABLE IF NOT EXISTS public.workout_sets (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id         UUID    NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_name      TEXT    NOT NULL,
  set_number         INT     NOT NULL CHECK (set_number > 0),
  previous_weight    NUMERIC CHECK (previous_weight >= 0),
  previous_reps      INT     CHECK (previous_reps >= 0),
  prescribed_weight  NUMERIC NOT NULL DEFAULT 0,
  prescribed_reps    INT     NOT NULL DEFAULT 0,
  actual_weight      NUMERIC CHECK (actual_weight >= 0),
  actual_reps        INT     CHECK (actual_reps >= 0),
  completed          BOOLEAN NOT NULL DEFAULT false,
  rest_seconds       INT     NOT NULL DEFAULT 60,
  section            TEXT    NOT NULL CHECK (section IN ('warmup', 'workout', 'cooldown')),
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- Add Flaherty workout progress tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_flaherty_workout INT DEFAULT 0;

-- Add Flaherty workouts table
CREATE TABLE IF NOT EXISTS public.flaherty_workouts (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  workout            INT     NOT NULL,
  exercise_name      TEXT    NOT NULL,
  sets               INT     NOT NULL DEFAULT 1,
  reps               INT     NOT NULL DEFAULT 10,
  weight             NUMERIC DEFAULT 0,
  rest_seconds       INT     DEFAULT 60,
  section            TEXT    NOT NULL DEFAULT 'workout',
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE flaherty_workouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workout_sessions
CREATE POLICY "Users can view their own workout sessions" ON workout_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workout sessions" ON workout_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout sessions" ON workout_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout sessions" ON workout_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for workout_sets
CREATE POLICY "Users can view their own workout sets" ON workout_sets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workout sets" ON workout_sets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout sets" ON workout_sets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout sets" ON workout_sets
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for flaherty_workouts (read-only for all users)
CREATE POLICY "Anyone can view Flaherty workouts" ON flaherty_workouts
  FOR SELECT USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_created_at ON workout_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_workout_sets_session_id ON workout_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_user_id ON workout_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_flaherty_workouts_workout ON flaherty_workouts(workout); 