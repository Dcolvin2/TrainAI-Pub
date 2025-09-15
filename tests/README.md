# Test Fixtures (Snapshot-Style)

These are reference snapshots for the workout JSON outputs.
They are not executable tests (to avoid build dependencies), but serve as a contract for Cursor.

## Guideline for edits:

If changing the plan schema or typical content, update the fixtures correspondingly.

Keep plans consistent with /lib/schemas/workout.ts and /docs/agent-prd.md.

## Suggested future step:

Add a lightweight script to validate docs/examples/*.json with validateWorkoutPlan at build time.
