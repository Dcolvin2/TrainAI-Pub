-- Allow NULL values for core_lift_id in workouts table
ALTER TABLE public.workouts ALTER COLUMN core_lift_id DROP NOT NULL; 