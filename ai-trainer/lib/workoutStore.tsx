import { createContext, useContext, useReducer, ReactNode, JSX } from 'react';

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
}

type WorkoutAction = 
  | { type: 'SET_ACTIVE'; payload: WorkoutData | null }
  | { type: 'SET_PENDING'; payload: WorkoutData | null }
  | { type: 'SET_TIME_AVAILABLE'; payload: number }
  | { type: 'ADD_QUICK_ENTRY_SETS'; payload: QuickEntryData }
  | { type: 'CLEAR_QUICK_ENTRY_SETS'; payload: void }
  | { type: 'ADD_OR_UPDATE_SET'; payload: WorkoutSet }
  | { type: 'CLEAR_WORKOUT_SETS'; payload: void }
  | { type: 'RESET' };

const initialState: WorkoutState = {
  active: null,
  pending: null,
  timeAvailable: 45,
  lastInit: null,
  quickEntrySets: [],
  workoutSets: []
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
    case 'RESET':
      return {
        ...state,
        active: null,
        pending: null,
        lastInit: new Date().toISOString().split('T')[0],
        quickEntrySets: [],
        workoutSets: []
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
  setActive: (active: WorkoutData | null) => void;
  setPending: (pending: WorkoutData | null) => void;
  setTimeAvailable: (time: number) => void;
  setQuickEntrySets: (data: QuickEntryData) => void;
  clearQuickEntrySets: () => void;
  addOrUpdateSet: (set: WorkoutSet) => void;
  clearWorkoutSets: () => void;
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
    reset: (): void => dispatch({ type: 'RESET' })
  };
} 