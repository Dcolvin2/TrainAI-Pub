import { NextResponse } from 'next/server';
import { PlanSchema } from '@/lib/planSchema';
import { tryExtractJson, normalizePlanShape } from '@/lib/planNormalize';
import { z, ZodError } from 'zod';
import { quickParse } from '@/lib/intent';
import { getEquipmentNamesForUser } from '@/lib/equipment';
import { planWorkout } from '@/lib/planner';
import { sanitize } from '@/lib/safety';
import type { Plan } from '@/lib/schemas';

export const runtime = 'nodejs';

// Graceful fallback plan
const fallback: Plan = {
  name: "Simple Strength",
  duration_min: 40,
  phases: [
    { phase: "warmup", items: [{ name: "Band Pull-Aparts", sets: 1, reps: "20", substitutions: [] }] },
    { phase: "main", items: [
        { name: "Goblet Squat", sets: 4, reps: "8-10", substitutions: [] },
        { name: "DB Row", sets: 4, reps: "8-12", substitutions: [] },
      ]},
    { phase: "cooldown", items: [{ name: "Couch Stretch", duration: "45s/side", substitutions: [] }] }
  ]
};

function pickUserId(req: Request): string | null {
  // Try query param first
  const url = new URL(req.url);
  const qs = url.searchParams.get('user');
  if (qs) return qs;

  // Try header
  const header = req.headers.get('x-user-id');
  if (header) return header;

  // Try body (for POST)
  try {
    const body = JSON.parse(req.body?.toString() || '{}');
    if (body.user) return body.user;
  } catch {}

  return null;
}

export async function POST(req: Request) {
  const userId = pickUserId(req);
  if (!userId) {
    return NextResponse.json({ 
      ok: false, 
      error: 'Missing ?user=<uuid> or x-user-id header or {user: "uuid"} in body' 
    }, { status: 400 });
  }

  try {
    const body = await req.json();
    const userMessage = body.q || body.message || '';

    // Parse user intent
    const intent = quickParse(userMessage);
    
    // Get user's equipment
    const equipment = await getEquipmentNamesForUser(userId);
    
    // Generate workout plan
    const { raw } = await planWorkout({
      userMsg: userMessage,
      equipment,
      duration: intent.duration_min || 45,
      modalityHints: intent.modality || 'mixed',
      styleHint: intent.athleteName ? `inspired by ${intent.athleteName}` : undefined
    });

    const modelText = raw.trim();
    const debugOn = new URL(req.url).searchParams.get("debug") === "1";

    // 1) Extract + normalize + validate
    const rawObj = tryExtractJson(modelText);
    if (!rawObj) {
      return NextResponse.json(
        debugOn
          ? { ok: false, error: "Model did not return JSON", raw_model_text: modelText }
          : { ok: false, error: "Failed to generate workout plan" },
        { status: 400 }
      );
    }

    const normalized = normalizePlanShape(rawObj);

    try {
      const plan = PlanSchema.parse(normalized);
      
      // Convert to strict Plan type and sanitize
      const strictPlan = {
        name: plan.name,
        duration_min: typeof plan.duration_min === 'string' ? parseInt(plan.duration_min, 10) : plan.duration_min,
        phases: plan.phases.map(phase => ({
          phase: phase.phase,
          items: phase.items.map(item => ({
            name: item.name,
            sets: typeof item.sets === 'string' ? parseInt(item.sets, 10) : item.sets,
            reps: typeof item.reps === 'string' ? item.reps : String(item.reps || ''),
            duration: item.duration,
            instruction: item.instruction,
            isAccessory: item.isAccessory,
            substitutions: [],
          }))
        })),
        progression_tip: typeof plan.progression_tip === 'string' ? plan.progression_tip : undefined,
      };
      
      const { plan: sanitized } = sanitize(strictPlan);
      
      // Generate narrative if requested
      let narrative = '';
      const url = new URL(req.url);
      if (url.searchParams.get('narrate') === '1') {
        try {
          const { Anthropic } = await import('@anthropic-ai/sdk');
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          
          const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 300,
            messages: [{
              role: 'user',
              content: `Write a brief, motivating narrative for this workout plan. Keep it under 3 sentences and focus on the user's goals and the workout structure:\n\n${JSON.stringify(sanitized, null, 2)}`
            }]
          });
          
          narrative = response.content[0].type === 'text' ? response.content[0].text : '';
        } catch (narrateErr) {
          console.warn('Narrative generation failed:', narrateErr);
          // Continue without narrative
        }
      }

      // ✅ SUCCESS — return full plan so your UI renders tables
      return NextResponse.json({ 
        ok: true, 
        message: narrative || `Planned: ${sanitized.name} (~${sanitized.duration_min} min).`,
        plan: sanitized,
        narrative: narrative || undefined
      });

    } catch (err) {
      // 3) Graceful fallback + rich debug
      if (err instanceof ZodError) {
        return NextResponse.json(
          debugOn
            ? {
                ok: true,
                message: "Planned (fallback; validation failed).",
                plan: fallback,
                validation_issues: err.issues,
                raw_model_text: modelText,
                normalized,
              }
            : { ok: true, message: "Planned (fallback).", plan: fallback }
        );
      }
      throw err;
    }

  } catch (error) {
    console.error('Workout generation error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Failed to generate workout plan',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  
  if (url.searchParams.get('health') === '1') {
    return NextResponse.json({ 
      ok: true, 
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  }

  return NextResponse.json({ 
    ok: false, 
    error: 'Use POST with workout request or GET ?health=1 for status' 
  }, { status: 405 });
}


