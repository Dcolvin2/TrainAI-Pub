-- Add duration_seconds field to workout_sets table to track how long each set took

ALTER TABLE public.workout_sets 
ADD COLUMN IF NOT EXISTS duration_seconds INT DEFAULT 0 CHECK (duration_seconds >= 0);

-- Add comment to clarify the field purpose
COMMENT ON COLUMN public.workout_sets.duration_seconds IS 'Time in seconds that the set took to complete (from start to complete button)';
