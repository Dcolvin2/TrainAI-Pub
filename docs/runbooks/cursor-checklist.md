# Cursor Checklist (paste into every request)

## READ FIRST (no code yet):
- Read /docs/agent-prd.md, /docs/architecture.md, /lib/schemas/workout.ts
- Briefly list the 3–6 most relevant bullets from those docs that apply to THIS change
- State the acceptance criteria in 3–5 bullets

## OUTPUT FORMAT REQUIRED:
1) **Doc-Anchor** — quote the exact doc bullets you're applying
2) **Mini spec** — 3–7 bullets of what you'll change and why (macro > micro)
3) **Unified patch** — one surgical diff only
4) **Self-Check** — confirm all of the following are true:
   - Uses strict JSON contract; 400 on invalid JSON
   - Phases include warmup/strength/accessory/cooldown (main lift first unless HIIT)
   - Cooldown matches focus muscles; no generic mismatches
   - Duration respected (pad or trim per PRD)
   - No unused imports/vars; TS strict
   - Doesn't contradict PRD or architecture
5) **Files touched** — list exact files

## APPLY THE PATCH ONLY AFTER THIS FORMAT IS COMPLETE
