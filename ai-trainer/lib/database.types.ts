export interface Database {
  public: {
    Tables: {
      exercises: {
        Row: {
          id: string;
          name: string;
          category: string;
          primary_muscle: string;
          equipment_required: string[];
          is_main_lift: boolean;
          exercise_phase: 'warmup' | 'cooldown' | 'main';
          instruction?: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          primary_muscle: string;
          equipment_required: string[];
          is_main_lift: boolean;
          exercise_phase: 'warmup' | 'cooldown' | 'main';
          instruction?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string;
          primary_muscle?: string;
          equipment_required?: string[];
          is_main_lift?: boolean;
          exercise_phase?: 'warmup' | 'cooldown' | 'main';
          instruction?: string;
        };
      };
      // Add other tables as needed
    };
  };
} 