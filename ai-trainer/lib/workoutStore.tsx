import { createContext, useContext, useReducer, ReactNode } from 'react';

interface WorkoutData {
  warmup: string[];
  workout: string[];
  cooldown: string[];
  accessories?: string[];
  prompt?: string;
}

interface WorkoutState {
  active: WorkoutData | null;
  pending: WorkoutData | null;
  timeAvailable: number;
  lastInit: string | null;
}

type WorkoutAction = 
  | { type: 'SET_ACTIVE'; payload: WorkoutData | null }
  | { type: 'SET_PENDING'; payload: WorkoutData | null }
  | { type: 'SET_TIME_AVAILABLE'; payload: number }
  | { type: 'RESET' };

const initialState: WorkoutState = {
  active: null,
  pending: null,
  timeAvailable: 45,
  lastInit: null
};

function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case 'SET_ACTIVE':
      return { ...state, active: action.payload };
    case 'SET_PENDING':
      return { ...state, pending: action.payload };
    case 'SET_TIME_AVAILABLE':
      return { ...state, timeAvailable: action.payload };
    case 'RESET':
      return {
        ...state,
        active: null,
        pending: null,
        lastInit: new Date().toISOString().split('T')[0]
      };
    default:
      return state;
  }
}

const WorkoutContext = createContext<{
  state: WorkoutState;
  dispatch: React.Dispatch<WorkoutAction>;
} | null>(null);

export function WorkoutProvider({ children }: { children: ReactNode }): React.JSX.Element {
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
  setActive: (active: WorkoutData | null) => void;
  setPending: (pending: WorkoutData | null) => void;
  setTimeAvailable: (time: number) => void;
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
    reset: (): void => dispatch({ type: 'RESET' })
  };
} 