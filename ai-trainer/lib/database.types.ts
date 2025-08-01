export interface Database {
  public: {
    Tables: {
      exercises: {
        Row: {
          id: string;
          name: string;
          category: string;
          muscle_group: string;
          required_equipment: string[];
          instruction: string;
          exercise_phase: 'core_lift' | 'accessory' | 'warmup' | 'mobility' | 'cooldown';
          rest_seconds_default: number;
          set_duration_seconds: number;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          muscle_group: string;
          required_equipment: string[];
          instruction: string;
          exercise_phase: 'core_lift' | 'accessory' | 'warmup' | 'mobility' | 'cooldown';
          rest_seconds_default: number;
          set_duration_seconds: number;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string;
          muscle_group?: string;
          required_equipment?: string[];
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