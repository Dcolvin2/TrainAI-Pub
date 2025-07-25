import { NextApiHandler } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const handler: NextApiHandler = async (req, res) => {
  const userId = req.query.userId as string
  const tables = ['profiles', 'equipment', 'weight_logs', 'user_goals', 'training_programs']
  const tableChecks: Record<string, { count: number | null; error: string | null }> = {}

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    tableChecks[table] = { count, error: error?.message || null }
  }

  return res.status(200).json({
    env: {
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasSupabaseURL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
    },
    tables: tableChecks
  })
}

export default handler 