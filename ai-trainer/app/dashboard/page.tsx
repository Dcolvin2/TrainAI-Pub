'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import WeightChart from '@/app/components/dashboard/WeightChart'
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

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
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

    fetchData()
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-[#1E293B] rounded-2xl w-1/3"></div>
            <div className="h-12 bg-[#1E293B] rounded-2xl w-full max-w-md"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  className="w-full sm:w-auto bg-primary hover:bg-primary-hover focus:bg-primary-hover text-white text-sm font-semibold py-3 px-6 rounded-xl shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
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

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Weight Progress Widget */}
          <div className="bg-[#1E293B] rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-semibold mb-4 tracking-wide">Weight Progress</h2>
            {profile?.weight && profile?.goal_weight ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted text-sm">Current</span>
                  <span className="font-medium">{profile.weight} lbs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted text-sm">Goal</span>
                  <span className="font-medium">{profile.goal_weight} lbs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted text-sm">Remaining</span>
                  <span className="font-medium text-accent">
                    {(profile.weight - profile.goal_weight).toFixed(1)} lbs
                  </span>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-[#334155] rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(100, Math.max(0, ((profile.weight - profile.goal_weight) / profile.weight) * 100))}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted text-sm">No weight data yet</p>
            )}
          </div>

          {/* Last Workout Widget */}
          <div className="bg-[#1E293B] rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-semibold mb-4 tracking-wide">Last Workout</h2>
            {lastWorkout ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted text-sm">Date</span>
                  <span className="font-medium">
                    {new Date(lastWorkout.created_at).toLocaleDateString()}
                  </span>
                </div>
                {lastWorkout.name && (
                  <div className="flex justify-between">
                    <span className="text-muted text-sm">Workout</span>
                    <span className="font-medium">{lastWorkout.name}</span>
                  </div>
                )}
                {lastWorkout.total_sets && (
                  <div className="flex justify-between">
                    <span className="text-muted text-sm">Sets</span>
                    <span className="font-medium">{lastWorkout.total_sets}</span>
                  </div>
                )}
                {lastWorkout.duration && (
                  <div className="flex justify-between">
                    <span className="text-muted text-sm">Duration</span>
                    <span className="font-medium">{lastWorkout.duration} mins</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-muted text-sm mb-4">No workouts logged yet</p>
                <Link href="/new-workout">
                  <button className="bg-primary hover:bg-primary-hover text-white font-medium px-4 py-2 rounded-xl shadow-md transition-all duration-200 text-sm">
                    Start First Workout
                  </button>
                </Link>
              </div>
            )}
          </div>

          {/* Weekly Workout Frequency */}
          <div className="bg-[#1E293B] rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-semibold mb-4 tracking-wide">Weekly Activity</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted text-sm">This Week</span>
                <Link href="/dashboard" className="text-sm text-accent hover:underline">
                  3 workouts
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="text-muted text-sm">Last Week</span>
                <span className="font-medium">4 workouts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted text-sm">Streak</span>
                <span className="font-medium text-primary">5 days</span>
              </div>
            </div>
          </div>

          {/* Weight Chart */}
          <div className="bg-[#1E293B] rounded-2xl p-6 shadow-md lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4 tracking-wide">Weight Progress Chart</h2>
            <WeightChart weightLogs={weightLogs} />
          </div>

          {/* AI Suggestion Card */}
          <div className="bg-[#1E293B] rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-semibold mb-4 tracking-wide">AI Training Feedback</h2>
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Your streak looks strong!
              </p>
              <p className="text-sm text-muted">
                Try adding more leg days for better balance and overall strength development.
              </p>
              <div className="mt-4">
                <button className="bg-[#334155] hover:bg-[#475569] text-foreground font-medium px-4 py-2 rounded-xl shadow-md transition-all duration-200 text-sm w-full">
                  Get Personalized Plan
                </button>
              </div>
            </div>
          </div>

          {/* Lift Progress Chart */}
          <div className="bg-[#1E293B] rounded-2xl p-6 shadow-md lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4 tracking-wide">Top Lifts Progress</h2>
            <LiftChart liftRecords={liftRecords} />
          </div>

          {/* Milestones Timeline */}
          <div className="bg-[#1E293B] rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-semibold mb-4 tracking-wide">Milestones</h2>
            {milestones.length > 0 ? (
              <div className="space-y-3">
                {milestones.slice(0, 3).map((milestone) => (
                  <div key={milestone.id} className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{milestone.type}</p>
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
                <p className="text-muted text-sm mb-4">No milestones yet</p>
                <button className="bg-[#334155] hover:bg-[#475569] text-foreground font-medium px-4 py-2 rounded-xl shadow-md transition-all duration-200 text-sm">
                  Set Your First Goal
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 