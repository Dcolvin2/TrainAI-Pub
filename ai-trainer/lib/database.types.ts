export interface Database {
  public: {
    Tables: {
      exercises_final: {
        Row: {
          id: string;
          name: string;
          category: string;
          primary_muscle: string;
          equipment_required: string[];
          instruction: string;
          exercise_phase: 'core_lift' | 'accessory' | 'warmup' | 'mobility' | 'cooldown';
          rest_seconds_default: number;
          set_duration_seconds: number;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          primary_muscle: string;
          equipment_required: string[];
          instruction: string;
          exercise_phase: 'core_lift' | 'accessory' | 'warmup' | 'mobility' | 'cooldown';
          rest_seconds_default: number;
          set_duration_seconds: number;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string;
          primary_muscle?: string;
          equipment_required?: string[];
          instruction?: string;
          exercise_phase?: 'core_lift' | 'accessory' | 'warmup' | 'mobility' | 'cooldown';
          rest_seconds_default?: number;
          set_duration_seconds?: number;
        };
      };
      equipment: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
      };
      user_equipment: {
        Row: {
          user_id: string;
          equipment_id: string | null;
          custom_name: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          equipment_id?: string | null;
          custom_name?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          equipment_id?: string | null;
          custom_name?: string | null;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          first_name: string;
          last_name: string | null;
          preferred_workout_days: string[] | null;
          created_at: string;
          last_flaherty_workout: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          first_name: string;
          last_name?: string | null;
          preferred_workout_days?: string[] | null;
          created_at?: string;
          last_flaherty_workout?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          first_name?: string;
          last_name?: string | null;
          preferred_workout_days?: string[] | null;
          created_at?: string;
          last_flaherty_workout?: number;
        };
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          goal_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_type?: string;
          created_at?: string;
        };
      };
      workout_templates: {
        Row: {
          id: string;
          user_id: string;
          workout_title: string;
          goal: string | null;
          equipment: string[] | null;
          day_of_week: string[] | null;
          exercises: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_title: string;
          goal?: string | null;
          equipment?: string[] | null;
          day_of_week?: string[] | null;
          exercises?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          workout_title?: string;
          goal?: string | null;
          equipment?: string[] | null;
          day_of_week?: string[] | null;
          exercises?: any | null;
          created_at?: string;
        };
      };
      workouts: {
        Row: {
          id: string;
          user_id: string;
          template_id: string | null;
          date: string;
          main_lifts: any | null;
          accessory_lifts: any | null;
          warmup: any | null;
          cooldown: any | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          template_id?: string | null;
          date?: string;
          main_lifts?: any | null;
          accessory_lifts?: any | null;
          warmup?: any | null;
          cooldown?: any | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          template_id?: string | null;
          date?: string;
          main_lifts?: any | null;
          accessory_lifts?: any | null;
          warmup?: any | null;
          cooldown?: any | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      workout_log_entries: {
        Row: {
          id: string;
          workout_id: string;
          exercise_name: string;
          set_number: number;
          reps: number | null;
          weight: number | null;
          rest_seconds: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workout_id: string;
          exercise_name: string;
          set_number: number;
          reps?: number | null;
          weight?: number | null;
          rest_seconds?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workout_id?: string;
          exercise_name?: string;
          set_number?: number;
          reps?: number | null;
          weight?: number | null;
          rest_seconds?: number | null;
          created_at?: string;
        };
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          workout_data: any;
          completed_at: string | null;
          total_sets: number;
          completed_sets: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_data?: any;
          completed_at?: string | null;
          total_sets?: number;
          completed_sets?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          workout_data?: any;
          completed_at?: string | null;
          total_sets?: number;
          completed_sets?: number;
          created_at?: string;
        };
      };
      workout_sets: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          exercise_name: string;
          set_number: number;
          previous_weight: number | null;
          previous_reps: number | null;
          prescribed_weight: number;
          prescribed_reps: number;
          actual_weight: number | null;
          actual_reps: number | null;
          completed: boolean;
          rest_seconds: number;
          section: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          exercise_name: string;
          set_number: number;
          previous_weight?: number | null;
          previous_reps?: number | null;
          prescribed_weight?: number;
          prescribed_reps?: number;
          actual_weight?: number | null;
          actual_reps?: number | null;
          completed?: boolean;
          rest_seconds?: number;
          section: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          exercise_name?: string;
          set_number?: number;
          previous_weight?: number | null;
          previous_reps?: number | null;
          prescribed_weight?: number;
          prescribed_reps?: number;
          actual_weight?: number | null;
          actual_reps?: number | null;
          completed?: boolean;
          rest_seconds?: number;
          section?: string;
          created_at?: string;
        };
      };
      flaherty_workouts: {
        Row: {
          id: string;
          workout: number;
          exercise_name: string;
          sets: number;
          reps: number;
          weight: number | null;
          rest_seconds: number;
          section: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workout: number;
          exercise_name: string;
          sets?: number;
          reps?: number;
          weight?: number | null;
          rest_seconds?: number;
          section?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workout?: number;
          exercise_name?: string;
          sets?: number;
          reps?: number;
          weight?: number | null;
          rest_seconds?: number;
          section?: string;
          created_at?: string;
        };
      };
    };
  };
} 