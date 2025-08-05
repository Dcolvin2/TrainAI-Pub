-- Enhanced User Profile Fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS training_goal text 
  CHECK (training_goal IN ('weight_loss', 'muscle_gain', 'strength', 'endurance', 'maintenance'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fitness_level text 
  CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_rep_range text
  CHECK (preferred_rep_range IN ('low_3-5', 'medium_6-12', 'high_12-20', 'mixed'));

-- Set default values for existing profiles
UPDATE profiles 
SET 
  training_goal = COALESCE(training_goal, 'weight_loss'),
  fitness_level = COALESCE(fitness_level, 'intermediate'),
  preferred_rep_range = COALESCE(preferred_rep_range, 'medium_6-12')
WHERE training_goal IS NULL OR fitness_level IS NULL OR preferred_rep_range IS NULL; 