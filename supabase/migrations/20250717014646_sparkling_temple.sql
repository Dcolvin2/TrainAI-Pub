/*
  # AI Trainer Database Schema - Fresh Setup

  1. New Tables
    - `equipment` - Master list of available equipment
    - `user_equipment` - User's selected equipment (from catalog + custom)
    - `profiles` - Extended user profiles with workout preferences
    - `goals` - User fitness goals (multiple allowed)
    - `workout_templates` - Saved workout routines
    - `workouts` - Logged workout sessions
    - `workout_log_entries` - Detailed per-set workout logging

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Public read access for equipment catalog

  3. Sample Data
    - Pre-populate equipment table with common gym equipment
    - Add sample workout templates for different goals
*/

-- Master equipment list
CREATE TABLE IF NOT EXISTS public.equipment (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Per-user equipment (catalog picks + customs)
CREATE TABLE IF NOT EXISTS public.user_equipment (
  user_id      UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  equipment_id UUID     REFERENCES public.equipment(id) ON DELETE SET NULL,
  custom_name  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, equipment_id, custom_name)
);

-- User profiles (onboarding)
CREATE TABLE IF NOT EXISTS public.profiles (
  id                       UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID   UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name               TEXT   NOT NULL,
  last_name                TEXT,
  preferred_workout_days   TEXT[],
  created_at               TIMESTAMPTZ DEFAULT now()
);

-- User goals (multiple selectable)
CREATE TABLE IF NOT EXISTS public.goals (
  id                 UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type          TEXT   NOT NULL CHECK (goal_type IN ('strength', 'endurance', 'hiit', 'fat_loss', 'muscle_gain', 'general_fitness')),
  created_at         DATE   NOT NULL DEFAULT CURRENT_DATE
);

-- Workout templates (saved routines)
CREATE TABLE IF NOT EXISTS public.workout_templates (
  id                       UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_title            TEXT   NOT NULL,
  goal                     TEXT   CHECK (goal IN ('strength', 'endurance', 'hiit', 'fat_loss', 'muscle_gain', 'general_fitness')),
  equipment                TEXT[] DEFAULT '{}',
  day_of_week              TEXT[] DEFAULT '{}',
  exercises                JSONB  DEFAULT '[]',
  created_at               TIMESTAMPTZ DEFAULT now()
);

-- Logged workouts
CREATE TABLE IF NOT EXISTS public.workouts (
  id                 UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id        UUID   REFERENCES public.workout_templates(id) ON DELETE SET NULL,
  date               DATE   NOT NULL DEFAULT CURRENT_DATE,
  main_lifts         JSONB  DEFAULT '[]',
  accessory_lifts    JSONB  DEFAULT '[]',
  warmup             JSONB  DEFAULT '[]',
  cooldown           JSONB  DEFAULT '[]',
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- Workout log entries (detailed per-set logging)
CREATE TABLE IF NOT EXISTS public.workout_log_entries (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id         UUID    NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  exercise_name      TEXT    NOT NULL,
  set_number         INT     NOT NULL CHECK (set_number > 0),
  reps               INT     CHECK (reps >= 0),
  weight             NUMERIC CHECK (weight >= 0),
  rest_seconds       INT     CHECK (rest_seconds >= 0),
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_log_entries ENABLE ROW LEVEL SECURITY;

-- Equipment policies (public read, admin write)
CREATE POLICY "Equipment is publicly readable"
  ON equipment
  FOR SELECT
  TO authenticated
  USING (true);

-- User equipment policies
CREATE POLICY "Users can manage their own equipment"
  ON user_equipment
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Profiles policies
CREATE POLICY "Users can read their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Goals policies
CREATE POLICY "Users can manage their own goals"
  ON goals
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Workout templates policies
CREATE POLICY "Users can manage their own workout templates"
  ON workout_templates
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Workouts policies
CREATE POLICY "Users can manage their own workouts"
  ON workouts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Workout log entries policies
CREATE POLICY "Users can manage their own workout log entries"
  ON workout_log_entries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts 
      WHERE workouts.id = workout_log_entries.workout_id 
      AND workouts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts 
      WHERE workouts.id = workout_log_entries.workout_id 
      AND workouts.user_id = auth.uid()
    )
  );

-- Insert sample equipment data
INSERT INTO equipment (name) VALUES
  ('Barbell'),
  ('Dumbbells'),
  ('Kettlebells'),
  ('Pull-up Bar'),
  ('Resistance Bands'),
  ('Bench'),
  ('Squat Rack'),
  ('Cable Machine'),
  ('Treadmill'),
  ('Stationary Bike'),
  ('Rowing Machine'),
  ('Medicine Ball'),
  ('Foam Roller'),
  ('Yoga Mat'),
  ('Jump Rope'),
  ('Battle Ropes'),
  ('Suspension Trainer'),
  ('Leg Press Machine'),
  ('Lat Pulldown Machine'),
  ('Smith Machine')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_equipment_user_id ON user_equipment(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_templates_user_id ON workout_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);
CREATE INDEX IF NOT EXISTS idx_workout_log_entries_workout_id ON workout_log_entries(workout_id);