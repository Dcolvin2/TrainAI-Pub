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
      // Add other tables as needed
    };
  };
} 