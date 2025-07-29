import React, { createContext, useContext, useReducer, ReactNode, JSX } from 'react';

interface WorkoutData {
  planId: string;
  warmup: string[];
  workout: string[];
  cooldown: string[];
  accessories?: string[];
  prompt?: string;
}

interface QuickEntrySet {
  setNumber: number;
  reps: number;
  actualWeight: number;
  completed: boolean;
}

interface QuickEntryData {
  exerciseName: string;
  entries: QuickEntrySet[];
}

interface LocalSet {
  exerciseName: string;
  setNumber: number;
  reps: number;
  actualWeight: number;
  completed: boolean;
}

interface WorkoutSet {
  id: string;
  exerciseName: string;
  setNumber: number;
  actualReps?: number;
  actualWeight?: number;
  completed: boolean;
  section: 'warmup' | 'workout' | 'cooldown' | 'accessories';
}

interface WorkoutState {
  active: WorkoutData | null;
  pending: WorkoutData | null;
  timeAvailable: number;
  lastInit: string | null;
  quickEntrySets: QuickEntryData[];
  workoutSets: WorkoutSet[];
  localSets: Record<string, LocalSet[]>;  // key = exerciseName
  firstPostWarmupExercise: string | null;
}

type WorkoutAction = 
  | { type: 'SET_ACTIVE'; payload: WorkoutData | null }
  | { type: 'SET_PENDING'; payload: WorkoutData | null }
  | { type: 'SET_TIME_AVAILABLE'; payload: number }
  | { type: 'ADD_QUICK_ENTRY_SETS'; payload: QuickEntryData }
  | { type: 'CLEAR_QUICK_ENTRY_SETS'; payload: void }
  | { type: 'ADD_OR_UPDATE_SET'; payload: WorkoutSet }
  | { type: 'CLEAR_WORKOUT_SETS'; payload: void }
  | { type: 'ADD_LOCAL_SET'; payload: LocalSet }
  | { type: 'CLEAR_LOCAL_SETS'; payload: void }
  | { type: 'SET_FIRST_POST_WARMUP_EXERCISE'; payload: string }
  | { type: 'RESET' };

const initialState: WorkoutState = {
  active: null,
  pending: null,
  timeAvailable: 45,
  lastInit: null,
  quickEntrySets: [],
  workoutSets: [],
  localSets: {},
  firstPostWarmupExercise: null
};

function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case 'SET_ACTIVE':
      return { ...state, active: action.payload };
    case 'SET_PENDING':
      return { ...state, pending: action.payload };
    case 'SET_TIME_AVAILABLE':
      return { ...state, timeAvailable: action.payload };
    case 'ADD_QUICK_ENTRY_SETS':
      return { 
        ...state, 
        quickEntrySets: [...state.quickEntrySets, action.payload]
      };
    case 'CLEAR_QUICK_ENTRY_SETS':
      return { ...state, quickEntrySets: [] };
    case 'ADD_OR_UPDATE_SET':
      return {
        ...state,
        workoutSets: state.workoutSets.map(set => 
          set.id === action.payload.id ? action.payload : set
        )
      };
    case 'CLEAR_WORKOUT_SETS':
      return { ...state, workoutSets: [] };
    case 'ADD_LOCAL_SET':
      return {
        ...state,
        localSets: {
          ...state.localSets,
          [action.payload.exerciseName]: [
            ...(state.localSets[action.payload.exerciseName] || []).filter(s => s.setNumber !== action.payload.setNumber),
            action.payload
          ].sort((a, b) => a.setNumber - b.setNumber)
        }
      };
    case 'CLEAR_LOCAL_SETS':
      return { ...state, localSets: {} };
    case 'SET_FIRST_POST_WARMUP_EXERCISE':
      return { ...state, firstPostWarmupExercise: action.payload };
    case 'RESET':
      return {
        ...state,
        active: null,
        pending: null,
        lastInit: new Date().toISOString().split('T')[0],
        quickEntrySets: [],
        workoutSets: [],
        localSets: {},
        firstPostWarmupExercise: null
      };
    default:
      return state;
  }
}

const WorkoutContext = createContext<{
  state: WorkoutState;
  dispatch: React.Dispatch<WorkoutAction>;
} | null>(null);

export function WorkoutProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(workoutReducer, initialState);

  return (
    <WorkoutContext.Provider value={{ state, dispatch }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkoutStore(): {
  active: WorkoutData | null;
  pending: WorkoutData | null;
  timeAvailable: number;
  lastInit: string | null;
  quickEntrySets: QuickEntryData[];
  workoutSets: WorkoutSet[];
  localSets: Record<string, LocalSet[]>;
  firstPostWarmupExercise: string | null;
  setActive: (active: WorkoutData | null) => void;
  setPending: (pending: WorkoutData | null) => void;
  setTimeAvailable: (time: number) => void;
  setQuickEntrySets: (data: QuickEntryData) => void;
  clearQuickEntrySets: () => void;
  addOrUpdateSet: (set: WorkoutSet) => void;
  clearWorkoutSets: () => void;
  addLocalSet: (set: LocalSet) => void;
  getLocalSetsForExercise: (exerciseName: string) => LocalSet[];
  clearLocalSets: () => void;
  setFirstPostWarmupExercise: (exerciseName: string) => void;
  reset: () => void;
} {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkoutStore must be used within a WorkoutProvider');
  }

  const { state, dispatch } = context;

  return {
    ...state,
    setActive: (active: WorkoutData | null): void => dispatch({ type: 'SET_ACTIVE', payload: active }),
    setPending: (pending: WorkoutData | null): void => dispatch({ type: 'SET_PENDING', payload: pending }),
    setTimeAvailable: (time: number): void => dispatch({ type: 'SET_TIME_AVAILABLE', payload: time }),
    setQuickEntrySets: (data: QuickEntryData): void => dispatch({ type: 'ADD_QUICK_ENTRY_SETS', payload: data }),
    clearQuickEntrySets: (): void => dispatch({ type: 'CLEAR_QUICK_ENTRY_SETS', payload: undefined }),
    addOrUpdateSet: (set: WorkoutSet): void => dispatch({ type: 'ADD_OR_UPDATE_SET', payload: set }),
    clearWorkoutSets: (): void => dispatch({ type: 'CLEAR_WORKOUT_SETS', payload: undefined }),
    addLocalSet: (set: LocalSet): void => dispatch({ type: 'ADD_LOCAL_SET', payload: set }),
    getLocalSetsForExercise: (exerciseName: string): LocalSet[] => state.localSets[exerciseName] || [],
    clearLocalSets: (): void => dispatch({ type: 'CLEAR_LOCAL_SETS', payload: undefined }),
    setFirstPostWarmupExercise: (exerciseName: string): void => dispatch({ type: 'SET_FIRST_POST_WARMUP_EXERCISE', payload: exerciseName }),
    reset: (): void => dispatch({ type: 'RESET' })
  };
} 