import { NextApiHandler } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const handler: NextApiHandler = async (req, res) => {
  try {
    console.log('Testing database tables...')
    
    // Test if tables exist by trying to query them
    const tables = ['equipment', 'user_goals']
    const results: Record<string, { exists: boolean; accessible: boolean; error: string | null; sampleData: unknown }> = {}
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1)
        
        results[table] = {
          exists: true,
          accessible: !error,
          error: error?.message || null,
          sampleData: data
        }
      } catch (err) {
        results[table] = {
          exists: false,
          accessible: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          sampleData: null
        }
      }
    }
    
    res.status(200).json({
      message: 'Database table test results',
      tables: results,
      env: {
        hasSupabaseURL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
      }
    })
  } catch (error) {
    console.error('Table test error:', error)
    res.status(500).json({
      error: 'Table test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export default handler 