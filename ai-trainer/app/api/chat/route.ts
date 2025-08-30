import { NextRequest, NextResponse } from 'next/server';
import { classifyWithLLM } from '@/lib/intentLLM';
import { resolveNikeFromNL, rowsToWorkout } from '@/lib/nikeResolver';
import { extractNikeHints } from '@/lib/nlpLite';
import { buildRuleBasedBackup } from '@/lib/backupWorkouts';
import { devlog } from '@/lib/devlog';
import { planWorkout } from '@/lib/planWorkout';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const split = (body?.split ?? '').toLowerCase();          // buttons
    const minutes = Number(body?.minutes ?? 45);
    const equipment: string[] = Array.isArray(body?.equipment) ? body.equipment : [];
    const text: string = (body?.text ?? '').trim();           // chat box
    const userId = body?.userId || body?.user;

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Missing userId' }, { status: 400 });
    }

    // 1) Button path is authoritative
    if (split) {
      devlog('router.button', { split, minutes, equipmentCount: equipment.length });
      const result = await generateFromLLM({ userId, split, minutes, equipment });
      return respond(result, { route: result.usedBackup ? 'backup' : 'llm', split, minutes });
    }

    // 2) Natural language classifier
    const llmIntent = await classifyWithLLM(text);
    devlog('router.classify', llmIntent);

    if (llmIntent.intent === 'nike') {
      const resolved = await resolveNikeFromNL(text, llmIntent.nike);
      devlog('router.nike.resolved', resolved.ok ? { rows: resolved.rows?.length } : resolved);
      if (resolved.ok && Array.isArray(resolved.rows)) {
        const wk = rowsToWorkout(resolved.rows);
        return respond({ plan: wk.plan, workout: wk.workout }, { route: 'nike-nl', minutes });
      }
      // Low confidence / not found / no rows: ask for confirmation instead of guessing
      return NextResponse.json({
        ok: true,
        needsConfirmation: true,
        message: makeConfirmMessage(text, llmIntent, extractNikeHints(text)),
        debug: { route: 'nike-nl-pending' }
      });
    }

    // 3) Split intent (e.g., "upper body push for 45 minutes")
    if (llmIntent.intent === 'split' && llmIntent.split) {
      devlog('router.split', { split: llmIntent.split, minutes });
      const result = await generateFromLLM({ userId, split: llmIntent.split, minutes, equipment });
      return respond(result, { route: result.usedBackup ? 'backup' : 'llm', split: llmIntent.split, minutes });
    }

    // 4) Plain chat → LLM workout suggestion or answer (no Nike)
    devlog('router.chat', { text: text.substring(0, 50) + '...', minutes });
    const result = await generateFromLLM({ userId, split: '', minutes, equipment, text });
    return respond(result, { route: result.usedBackup ? 'backup' : 'llm-chat', minutes });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error',
      debug: { route: 'error' }
    }, { status: 500 });
  }
}

async function generateFromLLM(opts: { 
  userId: string; 
  split: string; 
  minutes: number; 
  equipment: string[]; 
  text?: string;
}): Promise<{ plan?: any; workout?: any; usedBackup: boolean }> {
  try {
    const { workout, plan, coach, debug } = await planWorkout({
      userId: opts.userId,
      split: opts.split as any,
      minutes: opts.minutes,
      style: opts.split === 'hiit' ? 'hiit' : 'strength',
      message: opts.text || `${opts.split} workout ${opts.minutes} min use my equipment`,
      debug: 'none',
    });

    return { plan, workout, usedBackup: false };
  } catch (error) {
    console.error('LLM generation failed, using backup:', error);
    const backup = buildRuleBasedBackup(opts.split, opts.minutes, opts.equipment);
    return { plan: backup.plan, workout: backup.workout, usedBackup: true };
  }
}

function respond(result: { plan?: any; workout?: any }, meta: any) {
  const title = 'Session (~' + (meta?.minutes ?? 45) + ' min)';
  return NextResponse.json({
    ok: true,
    name: title,
    message: title,
    plan: result.plan,
    workout: result.workout,
    debug: { ...meta }
  });
}

function makeConfirmMessage(text: string, guess: any, hints: any) {
  const idx = guess?.nike?.index ?? hints.index ?? 1;
  const type = guess?.nike?.type ?? hints.typeHint ?? 'upper body';
  return `Did you mean Nike workout ${idx} for ${type}? Reply "/nike ${idx}" to run it, or say what you want.`;
}
