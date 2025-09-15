# Cursor Workflow: Macro Changes Without Piecemeal Patches

## Use These Prompts

**When updating the agent:**
> Update app/api/chat/route.ts to follow /docs/agent-prd.md and /docs/architecture.md. Keep business logic in /lib/workout.ts and validate with /lib/schemas/workout.ts. Return HTTP 400 on invalid JSON. No unused imports/vars.

**When adding a new rule (e.g., RPE targets):**
> First, update the JSON contract in /lib/schemas/workout.ts (types + validator). Then update generation in route.ts and add/adjust examples under /docs/examples. Keep diffs surgical.

**When changing cooldown logic:**
> Modify only /lib/workout.ts (selectCooldowns) to refine matching. Do not hardcode cooldowns in the API handler.

**When fixing duration/time-boxing behavior:**
> Use /lib/workout.ts::trimPlanToDuration. Do not duplicate heuristics elsewhere.

## Chunk Your Requests (Order Matters)

1. **Contract**: Update /lib/schemas/workout.ts.
2. **Logic**: Adjust /lib/workout.ts.
3. **Handler**: Wire in route.ts to use updated validator/helpers.
4. **Examples/Fixtures**: Update /docs/examples/*.json and /tests/fixtures.
5. **Rules**: If behavior changes, update .cursorrules.

## Non-Negotiables

- Strict JSON (invalid → 400).
- Core lift first in strength (except HIIT).
- Cooldowns must match focus muscles.
- Save to DB only on Finish.
- Motivational coach message, max 2 sentences.

## Quick Checklist Before Commit

- [ ] Contract updated?
- [ ] Helper functions updated (no duplication)?
- [ ] Handler uses validator + helpers?
- [ ] Examples/fixtures aligned?
- [ ] .cursorrules still accurate?
