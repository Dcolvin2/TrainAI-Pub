import { NextApiHandler } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const handler: NextApiHandler = async (req, res) => {
  try {
    // Test database connection
    console.log('Testing database connection...')
    
    // Test equipment table
    const { data: equip, error: equipError } = await supabase
      .from('equipment')
      .select('count')
      .limit(1)
    
    // Test user_goals table  
    const { data: goals, error: goalsError } = await supabase
      .from('user_goals')
      .select('count')
      .limit(1)
    
    res.status(200).json({
      message: 'Database test results',
      equipment: {
        accessible: !equipError,
        error: equipError?.message
      },
      user_goals: {
        accessible: !goalsError,
        error: goalsError?.message
      },
      env: {
        hasSupabaseURL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
      }
    })
  } catch (error) {
    console.error('Debug API error:', error)
    res.status(500).json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export default handler 