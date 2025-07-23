'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import Card from '@/app/components/ui/Card'
import Button from '@/app/components/ui/Button'
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

export default function Dashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [lastWorkout, setLastWorkout] = useState<Workout | null>(null)
  const [liftRecords, setLiftRecords] = useState<LiftRecord[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
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
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-card rounded mb-8 w-1/3"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-card rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">
          Welcome back, {profile?.first_name || 'Athlete'} 👋
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Weight Progress Widget */}
          <Card>
            <h2 className="text-lg font-semibold mb-4 text-primary">Weight Progress</h2>
            {profile?.weight && profile?.goal_weight ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted">Current:</span>
                  <span className="font-semibold">{profile.weight} lbs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Goal:</span>
                  <span className="font-semibold">{profile.goal_weight} lbs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Remaining:</span>
                  <span className="font-semibold text-accent">
                    {(profile.weight - profile.goal_weight).toFixed(1)} lbs
                  </span>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-card border rounded-full h-2">
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
              <p className="text-muted">No weight data yet</p>
            )}
          </Card>

          {/* Last Workout Widget */}
          <Card>
            <h2 className="text-lg font-semibold mb-4 text-primary">Last Workout</h2>
            {lastWorkout ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted">Date:</span>
                  <span className="font-semibold">
                    {new Date(lastWorkout.created_at).toLocaleDateString()}
                  </span>
                </div>
                {lastWorkout.name && (
                  <div className="flex justify-between">
                    <span className="text-muted">Workout:</span>
                    <span className="font-semibold">{lastWorkout.name}</span>
                  </div>
                )}
                {lastWorkout.total_sets && (
                  <div className="flex justify-between">
                    <span className="text-muted">Sets:</span>
                    <span className="font-semibold">{lastWorkout.total_sets}</span>
                  </div>
                )}
                {lastWorkout.duration && (
                  <div className="flex justify-between">
                    <span className="text-muted">Duration:</span>
                    <span className="font-semibold">{lastWorkout.duration} mins</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-muted mb-4">No workouts logged yet</p>
                <Button variant="primary" size="sm">
                  Start First Workout
                </Button>
              </div>
            )}
          </Card>

          {/* Weekly Workout Frequency */}
          <Card>
            <h2 className="text-lg font-semibold mb-4 text-primary">Weekly Activity</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">This Week:</span>
                <span className="font-semibold text-accent">3 workouts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Last Week:</span>
                <span className="font-semibold">4 workouts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Streak:</span>
                <span className="font-semibold text-primary">5 days</span>
              </div>
            </div>
          </Card>

          {/* Weight Chart */}
          <Card className="lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4 text-primary">Weight Progress Chart</h2>
            <WeightChart weightLogs={weightLogs} />
          </Card>

          {/* AI Suggestion Card */}
          <Card>
            <h2 className="text-lg font-semibold mb-4 text-primary">AI Training Feedback</h2>
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Your streak looks strong! 💪
              </p>
              <p className="text-sm text-muted">
                Try adding more leg days for better balance and overall strength development.
              </p>
              <div className="mt-4">
                <Button variant="secondary" size="sm" className="w-full">
                  Get Personalized Plan
                </Button>
              </div>
            </div>
          </Card>

          {/* Lift Progress Chart */}
          <Card className="lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4 text-primary">Top Lifts Progress</h2>
            <LiftChart liftRecords={liftRecords} />
          </Card>

          {/* Milestones Timeline */}
          <Card>
            <h2 className="text-lg font-semibold mb-4 text-primary">Milestones</h2>
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
                <p className="text-muted mb-4">No milestones yet</p>
                <Button variant="secondary" size="sm">
                  Set Your First Goal
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
} 