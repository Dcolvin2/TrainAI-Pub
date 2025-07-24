'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import WeightProgressWidget from '@/app/components/dashboard/WeightProgressWidget'
import LiftChart from '@/app/components/dashboard/LiftChart'

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

interface LiftRecord {
  id: string
  exercise_name: string
  max_weight: number
  recorded_at: string
}

interface Milestone {
  id: string
  type: string
  achieved_on: string
  description?: string
}

interface WorkoutProgram {
  id: string
  name: string
  current_week: number
  current_day: number
  total_weeks: number
  is_active: boolean
}

export default function Dashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [lastWorkout, setLastWorkout] = useState<Workout | null>(null)
  const [liftRecords, setLiftRecords] = useState<LiftRecord[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [activeProgram, setActiveProgram] = useState<WorkoutProgram | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    if (!user) return

    try {
      // Fetch profile data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profileData)

      // Fetch weight logs
      const { data: weights } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(10)
      setWeightLogs(weights || [])

      // Fetch last workout
      const { data: workouts } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
      setLastWorkout(workouts?.[0] || null)

      // Fetch lift records
      const { data: lifts } = await supabase
        .from('lift_records')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: true })
      setLiftRecords(lifts || [])

      // Fetch milestones
      const { data: milestoneData } = await supabase
        .from('milestones')
        .select('*')
        .eq('user_id', user.id)
        .order('achieved_on', { ascending: false })
      setMilestones(milestoneData || [])

      // Mock active program data (replace with actual Supabase query when table exists)
      // For now, simulate an active program
      const mockActiveProgram: WorkoutProgram = {
        id: '1',
        name: 'Strength Builder',
        current_week: 3,
        current_day: 2,
        total_weeks: 8,
        is_active: true
      }
      setActiveProgram(mockActiveProgram)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [user])

  const handleWeightLogged = () => {
    fetchData()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-[#1E293B] rounded-xl w-1/3"></div>
            <div className="h-12 bg-[#1E293B] rounded-xl w-full max-w-md"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-[#1E293B] rounded-2xl shadow-md"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="space-y-4">
          <h1 className="text-xl font-semibold tracking-wide">
            Welcome back, {profile?.first_name || 'Athlete'}
          </h1>
          
          {/* Action Buttons - Sticky at top for mobile */}
          <div className="sticky top-4 z-10 bg-background/95 backdrop-blur-sm py-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:static sm:bg-transparent sm:backdrop-blur-none">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              {/* Start Custom Workout Button */}
              <Link href="/new-workout" className="flex-1 sm:flex-none">
                <button 
                  className="w-full sm:w-auto bg-[#22C55E] hover:bg-[#16a34a] focus:bg-[#16a34a] text-white text-sm font-semibold py-3 px-6 rounded-xl shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                  aria-label="Start a new custom workout"
                >
                  Start Custom Workout
                </button>
              </Link>
              
              {/* Continue Program or Start Program Button */}
              <Link href="/workout-program" className="flex-1 sm:flex-none">
                <button 
                  className="w-full sm:w-auto bg-[#1E293B] hover:bg-[#334155] focus:bg-[#334155] text-foreground text-sm font-semibold py-3 px-6 rounded-xl shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/50"
                  aria-label={activeProgram ? `Continue ${activeProgram.name} program` : "Start a new workout program"}
                >
                  {activeProgram ? (
                    `Continue: Week ${activeProgram.current_week}, Day ${activeProgram.current_day}`
                  ) : (
                    "Start a Program"
                  )}
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Dashboard Grid - Improved Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 xl:grid-cols-12 gap-4">
          {/* Weight Progress Widget - Horizontal Layout */}
          <div className="md:col-span-6 xl:col-span-4">
            <WeightProgressWidget
              profile={profile}
              weightLogs={weightLogs}
              onWeightLogged={handleWeightLogged}
            />
          </div>

          {/* Last Workout Widget - Collapsed if no data */}
          <div className="md:col-span-6 xl:col-span-4">
            {lastWorkout ? (
              <div className="w-full rounded-2xl shadow-md bg-[#1E293B] text-white p-4 overflow-hidden">
                <h2 className="text-lg font-semibold mb-3">Last Workout</h2>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted">Date</span>
                    <span className="text-sm font-medium text-white">
                      {new Date(lastWorkout.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {lastWorkout.name && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted">Workout</span>
                      <span className="text-sm font-medium text-white">{lastWorkout.name}</span>
                    </div>
                  )}
                  {lastWorkout.total_sets && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted">Sets</span>
                      <span className="text-sm font-medium text-white">{lastWorkout.total_sets}</span>
                    </div>
                  )}
                  {lastWorkout.duration && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted">Duration</span>
                      <span className="text-sm font-medium text-white">{lastWorkout.duration} mins</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full rounded-2xl shadow-md bg-[#1E293B] text-white p-4 overflow-hidden">
                <h2 className="text-lg font-semibold mb-3">Last Workout</h2>
                <div className="text-center py-2">
                  <p className="text-sm text-muted mb-3">No workouts logged yet</p>
                  <Link href="/new-workout">
                    <button className="w-full sm:w-auto bg-[#22C55E] hover:bg-[#16a34a] text-white text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200">
                      Start First Workout
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Weekly Activity - Reduced Width */}
          <div className="md:col-span-6 xl:col-span-4">
            <div className="w-full rounded-2xl shadow-md bg-[#1E293B] text-white p-4 overflow-hidden">
              <h2 className="text-lg font-semibold mb-3">Weekly Activity</h2>
              <div className="space-y-2">
                <div className="flex justify-between items-center px-2 py-1 bg-[#0F172A] rounded-lg">
                  <span className="text-sm text-muted">This Week:</span>
                  <span className="text-sm font-semibold text-[#22C55E]">3</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1 bg-[#0F172A] rounded-lg">
                  <span className="text-sm text-muted">Last Week:</span>
                  <span className="text-sm font-semibold text-white">4</span>
                </div>
                <div className="flex justify-between items-center px-2 py-1 bg-[#0F172A] rounded-lg">
                  <span className="text-sm text-muted">Streak:</span>
                  <span className="text-sm font-semibold text-[#22C55E]">5 days</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Training Feedback - Vertical Layout */}
          <div className="md:col-span-6 xl:col-span-4">
            <div className="w-full rounded-2xl shadow-md bg-[#1E293B] text-white p-4 overflow-hidden">
              <h2 className="text-lg font-semibold mb-3">AI Training Feedback</h2>
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  Your streak looks strong! Try adding more leg days for better balance.
                </p>
                <button className="w-full bg-[#334155] hover:bg-[#475569] text-foreground font-medium px-3 py-2 rounded-lg shadow-md transition-all duration-200 text-sm">
                  Get Personalized Plan
                </button>
              </div>
            </div>
          </div>

          {/* Top Lifts Progress - Side by side with Milestones on large screens */}
          <div className="md:col-span-6 xl:col-span-6">
            <div className="w-full rounded-2xl shadow-md bg-[#1E293B] text-white p-4 overflow-hidden">
              <h2 className="text-lg font-semibold mb-3">Top Lifts Progress</h2>
              {liftRecords.length > 0 ? (
                <div className="mt-3 mb-2 overflow-hidden">
                  <LiftChart liftRecords={liftRecords} />
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted mb-3">No lift records yet</p>
                  <Link href="/new-workout">
                    <button className="w-full sm:w-auto bg-[#22C55E] hover:bg-[#16a34a] text-white text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200">
                      Log Your First Lift
                    </button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Milestones Timeline - Side by side with Top Lifts on large screens */}
          <div className="md:col-span-6 xl:col-span-6">
            <div className="w-full rounded-2xl shadow-md bg-[#1E293B] text-white p-4 overflow-hidden">
              <h2 className="text-lg font-semibold mb-3">Milestones</h2>
              {milestones.length > 0 ? (
                <div className="space-y-3">
                  {milestones.slice(0, 3).map((milestone) => (
                    <div key={milestone.id} className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-[#22C55E] rounded-full mt-2 flex-shrink-0"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{milestone.type}</p>
                        <p className="text-xs text-muted">
                          {new Date(milestone.achieved_on).toLocaleDateString()}
                        </p>
                        {milestone.description && (
                          <p className="text-xs text-muted mt-1">{milestone.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-muted mb-4">No milestones yet</p>
                  <button className="w-full sm:w-auto bg-[#334155] hover:bg-[#475569] text-foreground font-medium px-4 py-2 rounded-lg shadow-md transition-all duration-200 text-sm">
                    Set Your First Goal
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 