-- Add rotation counter to profiles table for forced main lift rotation
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS main_lift_rotation integer DEFAULT 0;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id); 