-- Insert weekly workout template data
INSERT INTO public.weekly_workout_template (day_of_week, workout_type, core_lift_name, focus_muscle_group) VALUES
('Monday', 'strength', 'Back Squat', 'legs'),
('Tuesday', 'strength', 'Bench Press', 'chest'),
('Wednesday', 'cardio', NULL, 'cardiovascular'),
('Thursday', 'hiit', NULL, 'full_body'),
('Friday', 'cardio', NULL, 'cardiovascular'),
('Saturday', 'strength', 'Trap Bar Deadlift', 'back'),
('Sunday', 'rest', NULL, 'recovery')
ON CONFLICT DO NOTHING; 