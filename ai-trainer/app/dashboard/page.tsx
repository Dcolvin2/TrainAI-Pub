'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DailyWorkout } from '@/app/components/DailyWorkout'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
)

interface Profile {
  id: string
  first_name: string
  weight?: number
  goal_weight?: number
}

interface WeightLog {
  id: string
  weight: number
  logged_at: string
}

interface Workout {
  id: string
  created_at: string
  total_sets?: number
  duration?: number
  name?: string
}

interface TrainingProgram {
  id: string
  user_id: string
  status: string
  current_week: number
  current_day: number
}

interface WeeklyStats {
  thisWeek: number
  lastWeek: number
  streak: number
}

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [showWeightForm, setShowWeightForm] = useState(false)
  const [newWeight, setNewWeight] = useState<string>('')
  const [lastWorkout, setLastWorkout] = useState<Workout | null>(null)
  const [program, setProgram] = useState<TrainingProgram | null>(null)
  const [weeklyStats] = useState<WeeklyStats>({ thisWeek: 0, lastWeek: 0, streak: 0 })
  const [isSubmittingWeight, setIsSubmittingWeight] = useState(false)
  const [weightError, setWeightError] = useState<string>('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return
      
      const uid = user.id
      const [{ data: prof }, { data: logs }, { data: wkt }, { data: prog }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', uid).single(),
        supabase.from('weight_logs').select('*').eq('user_id', uid).order('logged_at', { ascending: true }),
        supabase.from('workouts').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(1),
        supabase.from('training_programs').select('*').eq('user_id', uid).eq('status', 'active').single(),
      ])
      setProfile(prof)
      setWeightLogs(logs || [])
      setLastWorkout(wkt?.[0] || null)
      setProgram(prog || null)

      // you can fill weeklyStats here...
    }
    load()
  }, [])

  // Derived metrics
  const startW = weightLogs[0]?.weight
  const currentW = weightLogs[weightLogs.length - 1]?.weight
  const goalW = profile?.goal_weight
  const lost = startW && currentW ? (startW - currentW).toFixed(1) : null

  // Chart data
  const chartData = {
    labels: weightLogs.map(l => new Date(l.logged_at).toLocaleDateString()),
    datasets: [{
      label: 'Weight',
      data: weightLogs.map(l => l.weight),
      borderColor: '#22C55E',
      pointBackgroundColor: '#22C55E',
      tension: 0.3,
    }]
  }

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: false } },
    plugins: { legend: { display: false } }
  }

  // Handle weight submit
  async function submitWeight() {
    if (!profile?.id) {
      setWeightError('Profile not found. Please refresh the page.')
      return
    }

    const weight = parseFloat(newWeight)
    if (isNaN(weight) || weight <= 0) {
      setWeightError('Please enter a valid weight (greater than 0)')
      return
    }

    if (weight > 1000) {
      setWeightError('Please enter a realistic weight value')
      return
    }

    setIsSubmittingWeight(true)
    setWeightError('')

    try {
      const { data, error } = await supabase
        .from('weight_logs')
        .insert([{ 
          user_id: profile.id, 
          weight: weight,
          logged_at: new Date().toISOString()
        }])
        .select()

      if (error) {
        console.error('Weight logging error:', error)
        setWeightError('Failed to save weight. Please try again.')
        return
      }

      if (data && data[0]) {
        setWeightLogs(prev => [...prev, data[0]])
        setShowWeightForm(false)
        setNewWeight('')
        setWeightError('')
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setWeightError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmittingWeight(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      submitWeight()
    }
  }

  if (!profile?.id) {
    return (
      <main className="bg-[#0F172A] min-h-screen p-6 text-white">
        <div className="flex items-center justify-center h-full">
          <p>Loading...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-[#0F172A] min-h-screen p-6 text-white">
      {/* Top Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <DailyWorkout userId={profile.id} />
        {program && (
          <button className="bg-[#1E293B] px-5 py-3 rounded-xl">
            Continue: Week {program.current_week}, Day {program.current_day}
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">

        {/* Weight Tracker */}
        <section className="md:col-span-2 bg-[#1E293B] rounded-2xl p-4 shadow-md overflow-hidden">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Metrics */}
            <div className="flex-1">
              <h2 className="text-xl font-semibold">Weight Progress</h2>
              
              {/* Goal Weight Display */}
              {goalW && (
                <div className="mt-2 p-3 bg-[#0F172A] rounded-lg border border-[#334155]">
                  <p className="text-sm text-gray-400">Goal Weight</p>
                  <p className="text-lg font-semibold text-[#22C55E]">{goalW} lbs</p>
                </div>
              )}

              {/* Progress Display */}
              {lost ? (
                <p className="text-green-400 mt-2">You&apos;ve lost {lost} lbs</p>
              ) : weightLogs.length > 0 ? (
                <p className="text-sm text-gray-400 mt-2">Keep logging to see your progress</p>
              ) : (
                <p className="text-sm text-gray-400 mt-2">Log your first weight to get started</p>
              )}

              <div className="flex justify-between my-4">
                <div>
                  <p className="text-sm text-gray-400">Current</p>
                  <p className="text-lg font-medium">{currentW ?? '—'} lbs</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Starting</p>
                  <p className="text-lg font-medium">{startW ?? '—'} lbs</p>
                </div>
              </div>

              {!showWeightForm ? (
                <button
                  onClick={() => setShowWeightForm(true)}
                  className="bg-[#22C55E] px-4 py-2 rounded-lg font-medium hover:bg-[#16a34a] transition-colors"
                >
                  Log My Weight
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={newWeight}
                      onChange={e => setNewWeight(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Enter weight (lbs)"
                      className="flex-1 bg-[#0F172A] border border-[#334155] px-3 py-2 rounded-lg focus:border-[#22C55E] focus:outline-none"
                      disabled={isSubmittingWeight}
                    />
                    <button
                      onClick={submitWeight}
                      disabled={isSubmittingWeight || !newWeight.trim()}
                      className="bg-[#22C55E] px-4 py-2 rounded-lg font-medium hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmittingWeight ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  
                  {weightError && (
                    <p className="text-red-400 text-sm">{weightError}</p>
                  )}
                  
                  <button
                    onClick={() => {
                      setShowWeightForm(false)
                      setNewWeight('')
                      setWeightError('')
                    }}
                    className="text-gray-400 text-sm hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Chart */}
            <div className="h-40">
              {weightLogs.length > 0 ? (
                <Line data={chartData} options={chartOpts} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Weight chart will appear here
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Last Workout */}
        <section className="bg-[#1E293B] rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <h2 className="text-xl font-semibold">Last Workout</h2>
          {lastWorkout
            ? <p className="mt-2 text-sm">On {new Date(lastWorkout.created_at).toLocaleDateString()}</p>
            : (
              <button className="mt-4 bg-[#22C55E] px-4 py-2 rounded-lg font-medium hover:bg-[#16a34a]">
                Start First Workout
              </button>
            )
          }
        </section>

        {/* Weekly Activity */}
        <section className="bg-[#1E293B] rounded-2xl p-4 shadow-md">
          <h2 className="text-xl font-semibold">Weekly Activity</h2>
          <p className="text-sm mt-2">
            This Week: {weeklyStats.thisWeek} · Last Week: {weeklyStats.lastWeek} · Streak: {weeklyStats.streak} days
          </p>
        </section>

        {/* AI Feedback */}
        <section className="bg-[#1E293B] rounded-2xl p-4 shadow-md flex flex-col">
          <h2 className="text-xl font-semibold">AI Training Feedback</h2>
          <p className="text-sm text-gray-300 flex-1 mt-2">
            {program
              ? 'Your streak looks strong—keep it up!'
              : 'Complete a workout to get personalized tips.'}
          </p>
          <button className="mt-4 bg-[#334155] px-4 py-2 rounded-lg font-medium hover:bg-[#3f4a5a]">
            Get Personalized Plan
          </button>
        </section>

        {/* Top Lifts */}
        <section className="bg-[#1E293B] rounded-2xl p-4 shadow-md">
          <h2 className="text-xl font-semibold">Top Lifts Progress</h2>
          <p className="text-sm text-gray-400 mt-2">No lift records yet</p>
          <button className="mt-4 bg-[#22C55E] px-4 py-2 rounded-lg font-medium hover:bg-[#16a34a]">
            Log Your First Lift
          </button>
        </section>

        {/* Milestones */}
        <section className="bg-[#1E293B] rounded-2xl p-4 shadow-md">
          <h2 className="text-xl font-semibold">Milestones</h2>
          <p className="text-sm text-gray-400 mt-2">No milestones yet</p>
          <button className="mt-4 bg-[#22C55E] px-4 py-2 rounded-lg font-medium hover:bg-[#16a34a]">
            Set Your First Goal
          </button>
        </section>
      </div>
    </main>
  )
} 