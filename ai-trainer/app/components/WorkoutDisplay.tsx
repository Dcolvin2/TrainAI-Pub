'use client';

interface WorkoutDisplayProps {
  workout: {
    type: any;
    warmup: any[];
    mainExercises: any[];
    accessories: any[];
    cooldown: any[];
    duration: number;
    focus: string;
  };
}

export default function WorkoutDisplay({ workout }: WorkoutDisplayProps) {
  const formatMuscles = (muscles: string[]) => {
    return muscles.map(muscle => 
      muscle.charAt(0).toUpperCase() + muscle.slice(1)
    ).join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Workout Type Info */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-white">Workout Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Type:</span>
            <span className="ml-2 capitalize">{workout.type.name.replace('_', ' ')}</span>
          </div>
          <div>
            <span className="text-gray-400">Category:</span>
            <span className="ml-2 capitalize">{workout.type.category.replace('_', ' ')}</span>
          </div>
          <div>
            <span className="text-gray-400">Target Muscles:</span>
            <span className="ml-2">{formatMuscles(workout.type.target_muscles)}</span>
          </div>
          <div>
            <span className="text-gray-400">Duration:</span>
            <span className="ml-2">{workout.duration} min</span>
          </div>
        </div>
      </div>

      {/* Warmup */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-yellow-400">Warmup</h3>
        <div className="space-y-3">
          {workout.warmup.map((exercise, index) => (
            <div key={index} className="flex justify-between items-center p-3 bg-gray-800 rounded">
              <span className="font-medium text-white">{exercise.name}</span>
              <span className="text-gray-400">{exercise.duration}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Exercises */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-red-400">Main Exercises</h3>
        <div className="space-y-3">
          {workout.mainExercises.map((exercise, index) => (
            <div key={index} className="p-3 bg-gray-800 rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-white">{exercise.name}</span>
                <span className="text-gray-400">{exercise.sets} sets × {exercise.reps}</span>
              </div>
              <div className="text-sm text-gray-400">
                Rest: {exercise.rest}s • {exercise.instruction}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Accessories */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-blue-400">Accessories</h3>
        <div className="space-y-3">
          {workout.accessories.map((exercise, index) => (
            <div key={index} className="p-3 bg-gray-800 rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-white">{exercise.name}</span>
                <span className="text-gray-400">{exercise.sets} sets × {exercise.reps}</span>
              </div>
              <div className="text-sm text-gray-400">
                Rest: {exercise.rest}s • {exercise.instruction}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cooldown */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-green-400">Cooldown</h3>
        <div className="space-y-3">
          {workout.cooldown.map((exercise, index) => (
            <div key={index} className="flex justify-between items-center p-3 bg-gray-800 rounded">
              <span className="font-medium text-white">{exercise.name}</span>
              <span className="text-gray-400">{exercise.duration}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Time Breakdown */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-purple-400">Time Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {Math.round(workout.duration * 0.1)} min
            </div>
            <div className="text-sm text-gray-400">Warmup</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">
              {Math.round(workout.duration * 0.6)} min
            </div>
            <div className="text-sm text-gray-400">Main Work</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {Math.round(workout.duration * 0.25)} min
            </div>
            <div className="text-sm text-gray-400">Accessories</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {Math.round(workout.duration * 0.05)} min
            </div>
            <div className="text-sm text-gray-400">Cooldown</div>
          </div>
        </div>
      </div>
    </div>
  );
} 