# TrainAI Chat Agent PRD

## Goal
Generate personalized workouts by combining:
- DB as source of truth (equipment, profile, preferences, workout history).
- LLM for reasoning (choose lifts, build JSON plan, suggest progression).
- UI for rendering only (no free-text parsing).

The agent must output strict, structured JSON, allow short motivational coach messages, and save completed workouts into Supabase. Non-workout chats (quick Q&A) are allowed.

---

## Inputs
- userId (links to profiles, user_equipment, workout_sessions)
- message (free text: "push day", "ski trip program", "good triceps finisher?", etc.)
- split (optional: push | pull | legs | upper | hiit)

---

## Endpoint
- Single entry point: POST /api/chat/generateWorkout (core flow for generation).

---

## Session Handling
- Maintain one active chat_sessions row per user.
- When the session grows large, archive user+AI messages to workout_chat_log and trim in-memory context.
- On each request, the handler rebuilds context from DB (profile, equipment, last workouts, and recent chat summary) rather than keeping everything in RAM.

---

## Data Sources (Supabase)
1) Profile & Equipment

Source equipment via profiles → user_equipment → equipment join (not from free-text).

Use profiles.preferred_workout_duration, fitness_level, training_goal, preferred_rep_range, injuries.
2) Day/Core Lift Defaults

Always include a main/core lift for the day/split.

Accessories must be explicitly labeled as accessories.
3) History & Progression

Look up workout_sessions and workout_sets to fetch exact last weights/reps to show and to inform progression suggestions.

---

## LLM Behavior
- Strict JSON output only (see schema shape below). If invalid → return 400 (do not save, do not retry silently).
- Coach message: Exactly 1–2 sentences, motivational tone.
- Off-template requests (e.g., "Tabata", "ski prep"): try to map into a workout using available equipment.
- Non-workout chat: Allowed; respond concisely without JSON plan.

---

## Workout JSON (Schema Shape)
```json
{
  "split": "push",
  "duration": 45,
  "phases": [
    {
      "phase": "warmup",
      "items": [
        { "name": "Bike or Row", "duration": "3-5 min" },
        { "name": "Band Pull-Aparts", "reps": "12-15" }
      ]
    },
    {
      "phase": "strength",
      "items": [
        {
          "name": "Barbell Bench Press",
          "sets": "4",
          "reps": "5-8",
          "last": "185×6",
          "suggested": "190×5",
          "isAccessory": false
        }
      ]
    },
    {
      "phase": "accessory",
      "items": [
        { "name": "Incline DB Press", "sets": "3", "reps": "8-12", "isAccessory": true },
        { "name": "Lateral Raise", "sets": "3", "reps": "12-15", "isAccessory": true }
      ]
    },
    {
      "phase": "cooldown",
      "items": [
        { "name": "Chest Doorway Stretch", "duration": "2 min" },
        { "name": "Triceps Stretch", "duration": "1-2 min/side" }
      ]
    }
  ]
}
```

Requirements
- phases must include: warmup, strength, accessory, cooldown (unless HIIT day has no main lift).
- The first item in strength must be the main/core lift (except HIIT).
- Each item can include: name (required), sets or duration, optional reps, instruction, isAccessory (boolean).
- Include last and suggested for any lift with prior history.

---

## Cooldowns (Contextual)
- Choose cooldowns from exercises where exercise_phase = 'cooldown' and match the day's focus muscles (e.g., chest/shoulders/triceps for push; hamstrings/quads/glutes for legs).
- Never return mismatched cooldowns (e.g., pec stretch after a legs day).

---

## Time-Boxing Rules
- If user time < planned duration:

Cut accessories first until within time.

If still over, trim main lift volume (reduce sets).

---

## Saving
- Do not save on generation. Only save when user selects Finish:

Insert row into workout_sessions with workout_source = 'ai_generated' | 'day_of_week' | 'nike' | 'custom'.

Insert per-set rows into workout_sets with actual weights/reps.

---

## Errors
- If LLM output is not valid JSON per the schema shape, return HTTP 400 with a short reason.

---

## Non-Workout Chat
- Allowed. Keep responses short, helpful, and motivational where appropriate. Do not emit workout JSON for general Q&A.

---

## Example Coach Messages (Motivational, 1–2 sentences)
- "Push the main sets but leave 1–2 reps in the tank—consistency will stack wins fast."
- "Own your tempo today and focus on clean reps; progression comes from quality repeated."
