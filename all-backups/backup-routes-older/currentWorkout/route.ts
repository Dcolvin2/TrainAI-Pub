import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Fetch the most recent generated workout for this user
    const { data: workout, error } = await supabase
      .from('generated_workouts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('Error fetching workout:', error)
      return NextResponse.json({ error: 'Failed to fetch workout' }, { status: 500 })
    }

    if (!workout) {
      return NextResponse.json({ error: 'No workout found' }, { status: 404 })
    }

    // Parse the workout plan
    const plan = workout.plan || {}
    
    // Convert workout strings to structured exercise data
    const details = plan.workout?.map((exerciseString: string) => {
      // Parse exercise string like "Back Squat: 3x8 @ 100lb rest 90s"
      const [name, restPart] = exerciseString.split(' rest ')
      const [setsReps, weightPart] = name.split(' @ ')
      const [sets, reps] = setsReps.split('x')
      const weight = weightPart?.replace(/lb/, '') || ''
      const rest = restPart?.replace('s', '') || ''
      const exerciseName = name.split(':')[0]

      return {
        name: exerciseName,
        sets: Array.from({ length: parseInt(sets) || 1 }, () => ({
          previous: null,
          prescribed: parseInt(weight) || 0,
          reps: parseInt(reps) || 8,
          rest: parseInt(rest) || 60,
          rpe: 8
        }))
      }
    }) || []

    return NextResponse.json({
      warmup: plan.warmup || [],
      workout: plan.workout || [],
      cooldown: plan.cooldown || [],
      details,
      prompt: workout.prompt,
      minutes: workout.minutes,
      created_at: workout.created_at
    })

  } catch (error) {
    console.error('Current workout error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch current workout' 
    }, { status: 500 })
  }
} 