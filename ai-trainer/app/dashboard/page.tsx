'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [weightLogs, setWeightLogs] = useState<any[]>([])
  const [showWeightForm, setShowWeightForm] = useState(false)
  const [newWeight, setNewWeight] = useState<string>('')
  const [lastWorkout, setLastWorkout] = useState<any>(null)
  const [program, setProgram] = useState<any>(null)
  const [weeklyStats, setWeeklyStats] = useState({ thisWeek: 0, lastWeek: 0, streak: 0 })

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

  // Handle weight submit
  async function submitWeight() {
    if (!profile?.id) return
    
    const { data, error } = await supabase
      .from('weight_logs')
      .insert([{ user_id: profile.id, weight: parseFloat(newWeight) }])
    if (!error && data) {
      setWeightLogs(prev => [...prev, data[0]])
      setShowWeightForm(false)
      setNewWeight('')
    }
  }

  return (
    <main className="bg-[#0F172A] min-h-screen p-6 text-white">
      {/* Top Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <button className="bg-[#22C55E] px-5 py-3 rounded-xl font-semibold hover:bg-[#16a34a]">
          Start Custom Workout
        </button>
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
              {lost
                ? <p className="text-green-400 mt-1">You&apos;ve lost {lost} lbs</p>
                : <p className="text-sm text-gray-400 mt-1">Log two entries to see progress</p>
              }
              <div className="flex justify-between my-4">
                <div>
                  <p className="text-sm text-gray-400">Current</p>
                  <p className="text-lg font-medium">{currentW ?? '—'} lbs</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Goal</p>
                  <p className="text-lg font-medium">{goalW ?? '—'} lbs</p>
                </div>
              </div>
              <button
                onClick={() => setShowWeightForm(true)}
                className="bg-[#22C55E] px-4 py-2 rounded-lg font-medium hover:bg-[#16a34a]"
              >
                Log My Weight
              </button>

              {/* Inline Form */}
              {showWeightForm && (
                <div className="mt-4 flex gap-2">
                  <input
                    type="number"
                    value={newWeight}
                    onChange={e => setNewWeight(e.target.value)}
                    placeholder="Enter weight"
                    className="flex-1 bg-[#0F172A] border border-[#334155] px-3 py-2 rounded-lg"
                  />
                  <button
                    onClick={submitWeight}
                    className="bg-[#22C55E] px-4 py-2 rounded-lg hover:bg-[#16a34a]"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>

            {/* Chart Placeholder */}
            <div className="flex-1 h-40 bg-[#0F172A] rounded-lg flex items-center justify-center">
              <p className="text-sm text-gray-400">Weight chart will appear here</p>
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