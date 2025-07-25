import { NextApiHandler } from 'next'

const handler: NextApiHandler = async (req, res) => {
  res.status(200).json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    env: {
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasSupabaseURL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
    }
  })
}

export default handler 