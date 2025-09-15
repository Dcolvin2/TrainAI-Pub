# TrainAI System Architecture

## Purpose

Anchor all changes to a single architecture so edits aren't piecemeal. The UI renders JSON only, the API orchestrates, the DB is the source of truth, and the LLM composes structured plans.

## Roles

**UI (Next.js)**: Renders workout JSON; does not infer logic from free text.

**API**: Single entry for generation: POST /api/chat/generateWorkout. Fetches DB context, calls LLM, validates JSON, returns plan (save happens on Finish).

**LLM**: Reasoning + composition only. Must return strict JSON per PRD.

**DB (Supabase)**: Canonical store for profile, equipment, history, sessions.

## Core Flow

1. **Input**: userId, message (free text), optional split.

2. **DB Pull**: Join profiles → user_equipment → equipment. Load recent workout_sessions and workout_sets for last weights/reps. (See SQL schema docs.)

3. **Context Build**: Duration, fitness level, training goal, injuries, equipment list, last lifts.

4. **LLM Call**: Prompt with structured context; require JSON that includes warmup, strength (main/core first), accessory, cooldown (muscle-matched).

5. **Validate**: Reject invalid JSON (HTTP 400). No silent retries.

6. **Return**: JSON plan + short motivational coach message.

7. **Finish Action**: On user "Finish", persist to workout_sessions + workout_sets with workout_source tag.

## Invariants

- Strict JSON only; UI never parses ad-hoc text.
- Main/core lift is always first in strength (except HIIT).
- Cooldowns match the day's focus muscles; never generic/mismatched.
- Time-boxing: Cut accessories first; then trim main-lift volume.
- No equipment → generate bodyweight plan.

## Session Strategy

- One active chat_sessions row per user.
- When long, archive full user/AI messages to workout_chat_log.
- Each request rebuilds context from DB (no reliance on long in-memory chains).

## Extension Points

- Add fields to JSON plan (e.g., RPE targets) by updating the schema contract first.
- Add new splits or templates by extending core-lift mapping functions.
