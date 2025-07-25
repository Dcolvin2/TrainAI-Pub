import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(req: Request) {
  try {
    console.log('🔍 Starting workout generation with fresh API credits...')
    
    // Parse request body
    const body = await req.json()
    const { userId, minutes = 30, prompt: userPrompt } = body
    
    console.log('🔍 After body parsing:', { userId, minutes, hasUserPrompt: !!userPrompt })
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Fetch user data from Supabase
    console.log('🔍 Fetching user data from Supabase...')
    const [{ data: profile }, { data: equipment }, { data: goals }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('equipment').select('name').eq('user_id', userId),
      supabase.from('user_goals').select('description').eq('user_id', userId),
    ])
    
    console.log('🔍 After Supabase fetch:', {
      profileFound: !!profile,
      equipmentCount: equipment?.length || 0,
      goalsCount: goals?.length || 0,
      equipment: equipment?.map(e => e.name),
      goals: goals?.map(g => g.description)
    })

    // Build the prompt
    const equipmentList = equipment?.map(e => e.name).join(', ') || 'none'
    const goalsList = goals?.map(g => g.description).join(', ') || 'none'
    const systemPrompt = `
You are TrainAI, an expert fitness coach.
User goals: ${goalsList}.
Available equipment: ${equipmentList}.
User has ${minutes} minutes today.
Generate a workout with a 5–10min warm-up, main session, and 5min cool-down, fitting in ${minutes} minutes.
Return JSON: { warmup: string[], workout: string[], cooldown: string[] }.
`.trim()

    const userMessage = userPrompt 
      ? `Generate today's workout based on this request: ${userPrompt}`
      : 'Generate today\'s workout.'

    console.log('🔍 After building prompt:', { systemPrompt, userMessage })

    // Call OpenAI API
    console.log('🔍 Calling OpenAI API...')
    const resp = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      functions: [{
        name: 'generate_workout',
        description: 'Return a workout plan',
        parameters: {
          type: 'object',
          properties: {
            warmup: { type: 'array', items: { type: 'string' } },
            workout: { type: 'array', items: { type: 'string' } },
            cooldown: { type: 'array', items: { type: 'string' } }
          },
          required: ['warmup','workout','cooldown']
        }
      }],
      function_call: { name: 'generate_workout' }
    })

    console.log('🔍 After OpenAI call:', {
      hasChoices: !!resp.choices,
      choicesLength: resp.choices?.length,
      hasMessage: !!resp.choices?.[0]?.message,
      hasFunctionCall: !!resp.choices?.[0]?.message?.function_call
    })

    // Check if function_call exists
    if (!resp.choices[0]?.message?.function_call) {
      throw new Error('No function_call in response')
    }

    // Parse the response
    console.log('🔍 Parsing OpenAI response...')
    let plan
    try {
      const rawArguments = resp.choices[0].message.function_call.arguments
      console.log('🔍 Raw arguments:', rawArguments)
      plan = JSON.parse(rawArguments)
      console.log('🔍 After parsing response:', plan)
    } catch (parseError) {
      console.error('🔍 JSON parse error:', parseError)
      console.error('🔍 Raw arguments that failed to parse:', resp.choices[0].message.function_call.arguments)
      throw new Error(`JSON_PARSE: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`)
    }

    console.log('🔍 Workout generation successful!')
    
    // Save the generated workout to Supabase
    try {
      await supabase
        .from('generated_workouts')
        .insert([{
          user_id: profile.id,
          minutes,
          prompt: systemPrompt,
          plan,
          used_model: 'gpt-3.5-turbo'
        }])
      
      console.log('🔍 Workout saved to database')
    } catch (dbError) {
      console.error('🔍 Database save error:', dbError)
      // Don't fail the request if database save fails
    }
    
    return NextResponse.json({
      ...plan,
      prompt: systemPrompt
    })
    
  } catch (error: unknown) {
    console.error('🔍 Workout generation error:', error)
    
    const errorMessage = error instanceof Error ? error.message : String(error)
    const stepName = errorMessage.includes('JSON_PARSE') ? 'JSON_PARSE' :
                    errorMessage.includes('No function_call') ? 'OPENAI_RESPONSE' :
                    errorMessage.includes('User ID is required') ? 'URL_PARSING' :
                    'UNKNOWN'
    
    return NextResponse.json({ 
      error: `${stepName}: ${errorMessage}`
    }, { status: 500 })
  }
} 