-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.chat_session_workouts (
  chat_session_id uuid NOT NULL,
  workout_session_id uuid NOT NULL,
  CONSTRAINT chat_session_workouts_pkey PRIMARY KEY (chat_session_id, workout_session_id),
  CONSTRAINT chat_session_workouts_workout_session_id_fkey FOREIGN KEY (workout_session_id) REFERENCES public.workout_sessions(id),
  CONSTRAINT chat_session_workouts_chat_session_id_fkey FOREIGN KEY (chat_session_id) REFERENCES public.chat_sessions(id)
);
CREATE TABLE public.chat_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  started_at timestamp with time zone DEFAULT now(),
  context jsonb DEFAULT '{}'::jsonb,
  associated_workouts ARRAY DEFAULT '{}'::uuid[],
  is_active boolean DEFAULT true,
  CONSTRAINT chat_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.day_core_lifts (
  day_of_week text NOT NULL,
  core_lift text NOT NULL,
  CONSTRAINT day_core_lifts_pkey PRIMARY KEY (day_of_week)
);
CREATE TABLE public.equipment (
  name text NOT NULL UNIQUE,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT equipment_pkey PRIMARY KEY (id)
);
CREATE TABLE public.exercise_substitutions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  original_exercise text NOT NULL,
  substitute_exercise text NOT NULL,
  reason text,
  equipment_difference ARRAY,
  effectiveness_score numeric DEFAULT 1.0 CHECK (effectiveness_score >= 0::numeric AND effectiveness_score <= 1::numeric),
  original_exercise_id uuid,
  substitute_exercise_id uuid,
  CONSTRAINT exercise_substitutions_pkey PRIMARY KEY (id),
  CONSTRAINT exercise_substitutions_original_exercise_id_fkey FOREIGN KEY (original_exercise_id) REFERENCES public.exercises(id),
  CONSTRAINT exercise_substitutions_substitute_exercise_id_fkey FOREIGN KEY (substitute_exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  primary_muscle text NOT NULL,
  equipment_required ARRAY DEFAULT '{}'::text[],
  instruction text,
  exercise_phase text DEFAULT 'main'::text CHECK (exercise_phase = ANY (ARRAY['warmup'::text, 'cooldown'::text, 'main'::text, 'core_lift'::text, 'accessory'::text])),
  rest_seconds_default integer,
  set_duration_seconds integer,
  target_muscles ARRAY DEFAULT '{}'::text[],
  movement_pattern text,
  is_compound boolean DEFAULT false,
  CONSTRAINT exercises_pkey PRIMARY KEY (id)
);
CREATE TABLE public.lifts (
  name text NOT NULL UNIQUE,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  CONSTRAINT lifts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.nike_workouts (
  workout integer,
  workout_type text,
  sets bigint,
  reps text,
  exercise text,
  instructions text,
  exercise_type text,
  exercise_phase text DEFAULT 'main'::text CHECK (exercise_phase = ANY (ARRAY['warmup'::text, 'cooldown'::text, 'main'::text])),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  equipment_needed ARRAY,
  rest_seconds integer DEFAULT 60,
  tempo text,
  CONSTRAINT nike_workouts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.personal_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exercise_name text NOT NULL,
  weight numeric NOT NULL,
  reps integer NOT NULL,
  calculated_1rm numeric DEFAULT 
CASE
    WHEN (reps = 1) THEN weight
    ELSE (weight * ((1)::numeric + ((reps)::numeric / (30)::numeric)))
END,
  achieved_date timestamp with time zone DEFAULT now(),
  workout_id uuid,
  notes text,
  exercise_id uuid,
  CONSTRAINT personal_records_pkey PRIMARY KEY (id),
  CONSTRAINT personal_records_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id),
  CONSTRAINT personal_records_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES public.workouts(id),
  CONSTRAINT personal_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  first_name text,
  hr_max integer,
  rest_timer_default integer NOT NULL DEFAULT 120,
  preferred_workout_duration integer NOT NULL DEFAULT 45,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  streak_count integer DEFAULT 0,
  user_id uuid,
  last_name text NOT NULL,
  current_weight numeric,
  desired_weight numeric,
  profile_complete boolean NOT NULL DEFAULT false,
  height_cm numeric,
  date_of_birth date,
  experience_level text,
  weight numeric,
  goal_weight numeric,
  equipment text,
  last_nike_workout integer DEFAULT 0,
  training_goal text DEFAULT 'weight_loss'::text CHECK (training_goal = ANY (ARRAY['weight_loss'::text, 'muscle_gain'::text, 'strength'::text, 'endurance'::text, 'maintenance'::text])),
  fitness_level text DEFAULT 'intermediate'::text CHECK (fitness_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text])),
  injuries jsonb DEFAULT '[]'::jsonb,
  weekly_workout_goal integer DEFAULT 4,
  preferred_rep_range text DEFAULT 'hypertrophy_6-12'::text CHECK (preferred_rep_range = ANY (ARRAY['strength_1-5'::text, 'hypertrophy_6-12'::text, 'endurance_13-20'::text, 'mixed'::text])),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.training_programs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  program_name text NOT NULL UNIQUE,
  current_week integer DEFAULT 1,
  current_day integer DEFAULT 1,
  status text DEFAULT 'active'::text,
  started_at timestamp with time zone DEFAULT now(),
  CONSTRAINT training_programs_pkey PRIMARY KEY (id),
  CONSTRAINT training_programs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_equipment (
  user_id uuid NOT NULL,
  equipment_id uuid,
  custom_name text NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  is_available boolean DEFAULT true,
  CONSTRAINT user_equipment_pkey PRIMARY KEY (id),
  CONSTRAINT user_equipment_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id),
  CONSTRAINT user_equipment_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  preferred_exercises ARRAY DEFAULT '{}'::text[],
  avoided_exercises ARRAY DEFAULT '{}'::text[],
  rest_time_preference integer DEFAULT 60,
  notification_settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.weekly_workout_template (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  day_of_week text NOT NULL CHECK (day_of_week = ANY (ARRAY['Monday'::text, 'Tuesday'::text, 'Wednesday'::text, 'Thursday'::text, 'Friday'::text, 'Saturday'::text, 'Sunday'::text])),
  workout_type text NOT NULL,
  core_lift_name text,
  focus_muscle_group text,
  estimated_duration_minutes integer DEFAULT 45,
  CONSTRAINT weekly_workout_template_pkey PRIMARY KEY (id)
);
CREATE TABLE public.workout_chat_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workout_session_id uuid NOT NULL,
  user_message text NOT NULL,
  ai_response text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workout_chat_log_pkey PRIMARY KEY (id),
  CONSTRAINT workout_chat_log_session_fkey FOREIGN KEY (workout_session_id) REFERENCES public.workout_sessions(id)
);
CREATE TABLE public.workout_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  date date,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  total_volume integer,
  program_day_id uuid,
  exercise_id uuid,
  exercise_name text,
  set_number integer,
  previous_weight integer,
  prescribed_weight integer,
  actual_weight integer,
  reps integer,
  rest_seconds integer DEFAULT 120,
  rpe integer DEFAULT 7,
  session_id_old uuid,
  set_id_old uuid,
  workout_source text CHECK (workout_source = ANY (ARRAY['nike'::text, 'custom'::text, 'ai_generated'::text])),
  CONSTRAINT workout_entries_pkey PRIMARY KEY (id),
  CONSTRAINT workout_entries_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id),
  CONSTRAINT workout_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT workout_entries_set_id_old_fkey FOREIGN KEY (set_id_old) REFERENCES public.workout_sets(id),
  CONSTRAINT workout_entries_session_id_old_fkey FOREIGN KEY (session_id_old) REFERENCES public.workout_sessions(id)
);
CREATE TABLE public.workout_log_entries (
  workout_id uuid,
  exercise_name text,
  set_number integer,
  reps integer,
  weight numeric,
  rest_seconds integer,
  equipment_used text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp without time zone DEFAULT now(),
  rpe integer,
  duration_minutes integer,
  exercise_id uuid,
  CONSTRAINT workout_log_entries_pkey PRIMARY KEY (id),
  CONSTRAINT workout_log_entries_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id),
  CONSTRAINT workout_log_entries_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES public.workouts(id)
);
CREATE TABLE public.workout_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  date date NOT NULL DEFAULT CURRENT_DATE,
  started_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone,
  total_volume integer DEFAULT 0,
  program_day_id uuid,
  nike_workout_number integer,
  workout_source text CHECK (workout_source = ANY (ARRAY['nike'::text, 'custom'::text, 'ai_generated'::text])),
  workout_name text,
  workout_type text,
  planned_exercises jsonb,
  completed_exercises jsonb,
  chat_context jsonb,
  difficulty_rating integer CHECK (difficulty_rating >= 1 AND difficulty_rating <= 10),
  actual_duration_minutes integer,
  CONSTRAINT workout_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT workout_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.workout_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid,
  exercise_name text NOT NULL,
  set_number integer NOT NULL,
  previous_weight integer,
  prescribed_weight numeric,
  actual_weight integer,
  reps integer,
  rest_seconds integer DEFAULT 120,
  rpe integer DEFAULT 7,
  exercise_id uuid,
  prescribed_load text,
  CONSTRAINT workout_sets_pkey PRIMARY KEY (id),
  CONSTRAINT workout_sets_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.workout_sessions(id),
  CONSTRAINT workout_sets_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.workout_streaks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  start_date date NOT NULL,
  current_streak integer DEFAULT 1,
  longest_streak integer DEFAULT 1,
  last_workout_date date NOT NULL,
  is_active boolean DEFAULT true,
  CONSTRAINT workout_streaks_pkey PRIMARY KEY (id),
  CONSTRAINT workout_streaks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.workout_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text NOT NULL,
  target_muscles ARRAY NOT NULL,
  movement_patterns ARRAY,
  CONSTRAINT workout_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.workouts (
  accessory_lifts jsonb DEFAULT '[]'::jsonb,
  session_type text,
  rest_timer integer,
  main_lifts jsonb,
  notes text,
  template_id uuid,
  agent_feedback text,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  date date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  user_id uuid,
  main_lift text,
  sets jsonb,
  warmup jsonb,
  cooldown jsonb,
  total_volume double precision,
  pr_flags jsonb,
  duration_minutes integer,
  avg_hr integer,
  focus_area text,
  workout_type text,
  program_name text,
  program_workout_number integer,
  workout_type_id uuid,
  generated_by text CHECK (generated_by = ANY (ARRAY['claude'::text, 'system'::text, 'user'::text, 'nike'::text])),
  equipment_used ARRAY,
  target_muscles ARRAY,
  nike_workout_number integer,
  CONSTRAINT workouts_pkey PRIMARY KEY (id),
  CONSTRAINT workouts_workout_type_fkey FOREIGN KEY (workout_type_id) REFERENCES public.workout_types(id)
);

-- Use this schema as source of truth. In code, treat exercises.equipment_required or exercises.required_equipment as the same field, whichever exists. Treat user_equipment.is_available as optional (default true when missing). Don’t change response payload shapes.


