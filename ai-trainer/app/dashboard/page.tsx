'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

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
  const [lastWorkout, setLastWorkout] = useState<Workout | null>(null)
  const [program, setProgram] = useState<TrainingProgram | null>(null)
  const [weeklyStats] = useState<WeeklyStats>({ thisWeek: 0, lastWeek: 0, streak: 0 })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return
      
      const uid = user.id
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).single()
      setProfile(prof)

      const { data: logs } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', uid)
        .order('logged_at', { ascending: true })
      setWeightLogs(logs || [])

      const { data: wkt } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(1)
      setLastWorkout(wkt?.[0] || null)

      const { data: prog } = await supabase
        .from('training_programs')
        .select('*')
        .eq('user_id', uid)
        .eq('status', 'active')
        .single()
      setProgram(prog)

      // example weekly stats logic
      // ...fetch and setWeeklyStats({ thisWeek: X, lastWeek: Y, streak: Z })
    }
    load()
  }, [])

  // compute weight metrics
  const startW = weightLogs[0]?.weight
  const currentW = weightLogs[weightLogs.length - 1]?.weight
  const goalW = profile?.goal_weight
  const lost = startW && currentW ? (startW - currentW).toFixed(1) : null

  return (
    <main className="bg-[#0F172A] min-h-screen p-6 text-white">

      {/* — Top Action Bar — */}
      <div className="flex flex-col sm:flex-row gap-3 justify-start mb-6">
        <button className="bg-[#22C55E] text-white font-semibold py-3 px-5 rounded-xl hover:bg-[#16a34a]">
          Start Custom Workout
        </button>
        {program && (
          <button className="bg-[#1E293B] text-white py-3 px-5 rounded-xl">
            Continue: Week {program.current_week}, Day {program.current_day}
          </button>
        )}
      </div>

      {/* — Dashboard Grid — */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 auto-rows-min">

        {/* Weight Tracker (horizontal, spans 2 cols on md+) */}
        <section className="md:col-span-2 bg-[#1E293B] rounded-2xl p-4 shadow-md overflow-hidden">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-2">Weight Progress</h2>
              {lost ? (
                <p className="text-green-400 mb-2">You&apos;ve lost {lost} lbs</p>
              ) : (
                <p className="text-sm text-gray-400 mb-2">Log two weights to see progress</p>
              )}
              <div className="flex justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-400">Current</p>
                  <p className="text-lg font-medium">{currentW ?? '—'} lbs</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Goal</p>
                  <p className="text-lg font-medium">{goalW ?? '—'} lbs</p>
                </div>
              </div>
            </div>
            <div className="flex-1 h-40 overflow-hidden bg-[#0F172A] rounded-lg flex items-center justify-center">
              <p className="text-sm text-gray-400">Weight chart will appear here</p>
            </div>
          </div>
          <button className="mt-4 bg-[#22C55E] text-white py-2 px-4 rounded-lg">
            Log My Weight
          </button>
        </section>

        {/* Last Workout (vertical, single col) */}
        <section className="bg-[#1E293B] rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <h2 className="text-xl font-semibold mb-2">Last Workout</h2>
          {lastWorkout ? (
            <div>
              <p className="text-sm">On {new Date(lastWorkout.created_at).toLocaleDateString()}</p>
              {/* add details */}
            </div>
          ) : (
            <button className="mt-4 bg-[#22C55E] text-white py-2 px-4 rounded-lg">
              Start First Workout
            </button>
          )}
        </section>

        {/* Weekly Activity (compact horizontal stats) */}
        <section className="bg-[#1E293B] rounded-2xl p-4 shadow-md">
          <h2 className="text-xl font-semibold mb-3">Weekly Activity</h2>
          <div className="flex justify-between text-sm">
            <span>This Week: {weeklyStats.thisWeek}</span>
            <span>Last Week: {weeklyStats.lastWeek}</span>
            <span>Streak: {weeklyStats.streak} days</span>
          </div>
        </section>

        {/* AI Feedback (vertical) */}
        <section className="bg-[#1E293B] rounded-2xl p-4 shadow-md flex flex-col">
          <h2 className="text-xl font-semibold mb-2">AI Training Feedback</h2>
          <p className="text-sm text-gray-300 flex-1">
            {program
              ? 'Your streak looks strong—keep it up!'
              : 'Complete a workout to get personalized tips.'}
          </p>
          <button className="mt-4 bg-[#334155] text-white py-2 px-4 rounded-lg">
            Get Personalized Plan
          </button>
        </section>

        {/* Top Lifts (compact) */}
        <section className="bg-[#1E293B] rounded-2xl p-4 shadow-md">
          <h2 className="text-xl font-semibold mb-3">Top Lifts Progress</h2>
          <p className="text-sm text-gray-400">No lift records yet</p>
          <button className="mt-4 bg-[#22C55E] text-white py-2 px-4 rounded-lg">
            Log Your First Lift
          </button>
        </section>

        {/* Milestones (compact) */}
        <section className="bg-[#1E293B] rounded-2xl p-4 shadow-md">
          <h2 className="text-xl font-semibold mb-3">Milestones</h2>
          <p className="text-sm text-gray-400">No milestones yet</p>
          <button className="mt-4 bg-[#22C55E] text-white py-2 px-4 rounded-lg">
            Set Your First Goal
          </button>
        </section>
      </div>
    </main>
  )
} 