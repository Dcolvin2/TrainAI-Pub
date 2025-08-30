# Workout Generation Debugging System

This document describes the comprehensive debugging and hardening system implemented for workout generation.

## 1. Debug Logging System

### Setup
- **File**: `lib/devlog.ts`
- **Environment Variable**: `NEXT_PUBLIC_DEBUG_WORKOUT=1`
- **Vercel Setup**: Project → Settings → Environment Variables

### Usage
```typescript
import { devlog } from '@/lib/devlog';

devlog('input', { split, minutes, equipmentCount });
devlog('model.raw', rawText);
devlog('parse', extracted);
devlog('validate', validity);
```

### Logs Location
- **Vercel**: Project → Functions → Logs
- **Local**: Browser console (when DEBUG_MODE is enabled)

## 2. JSON Extraction & Validation

### Robust JSON Parsing
- Handles ```json fencing
- Extracts JSON from mixed text/JSON responses
- Provides detailed error messages

### Validation System
- Validates workout structure
- Checks for required fields
- Ensures non-empty workout arrays

## 3. Rule-Based Backup System

### Location
- **File**: `lib/backupWorkouts.ts`
- **Function**: `buildRuleBasedBackup(split, minutes, equipment)`

### Supported Splits
- `push`: Bench press, overhead press, incline press, triceps
- `pull`: Lat pulldown, rows, curls
- `legs`: Squats, deadlifts, lunges, calf raises
- `hiit`: Intervals, EMOM, battle ropes
- `default`: Full body circuit

### Equipment Detection
- Automatically detects available equipment
- Provides appropriate substitutions
- Uses exact equipment names from database

## 4. UI Guardrails

### Content Validation
```typescript
const hasContent = (w?: { warmup?: unknown[]; main?: unknown[]; cooldown?: unknown[] }) =>
  !!w && ((w.warmup?.length ?? 0) + (w.main?.length ?? 0) + (w.cooldown?.length ?? 0) > 0);
```

### User Experience
- Shows "Generating..." instead of "AI is thinking..."
- 15-second timeout with AbortController
- Clear error messages for timeouts
- Prevents showing "Start Workout" for empty workouts

## 5. API Response Structure

### Debug Information
```typescript
{
  ok: true,
  name: "Push Session (~45 min)",
  message: "Push Session (~45 min)",
  coach: null,
  plan: PlanShape,
  workout: WorkoutShape,
  debug: {
    usedTwoPass: false,
    minutesRequested: 45,
    split: "push",
    equipmentList: ["barbell", "dumbbells"],
    parseError: null,
    validity: "ok"
  }
}
```

## 6. Testing

### Test Script
```bash
node test-debug.js
```

### Manual Testing
1. Set `NEXT_PUBLIC_DEBUG_WORKOUT=1` in environment
2. Generate a workout
3. Check browser console for debug logs
4. Verify backup system works by temporarily breaking LLM response

## 7. Troubleshooting

### Common Issues
1. **Empty workouts**: Check `validity` in debug response
2. **Parse errors**: Check `parseError` in debug response
3. **Timeouts**: Verify 15-second timeout is working
4. **Equipment issues**: Check `equipmentList` in debug response

### Debug Flow
1. `input` → Logs request parameters
2. `model.raw` → Logs raw LLM response
3. `parse` → Logs JSON extraction results
4. `validate` → Logs validation results
5. `fallback.reason` → Logs why backup was used (if applicable)

## 8. Environment Variables

### Required for Debugging
```bash
NEXT_PUBLIC_DEBUG_WORKOUT=1
```

### Optional for Testing
```bash
ANTHROPIC_API_KEY=your_key_here
```

## 9. Files Modified

1. `lib/devlog.ts` - Debug logging system
2. `lib/backupWorkouts.ts` - Rule-based backup workouts
3. `app/api/chat-workout/route.ts` - Main API with debugging
4. `app/components/WorkoutChatBuilder.tsx` - UI guardrails
5. `test-debug.js` - Test script

## 10. Next Steps

1. Deploy to Vercel with environment variable
2. Monitor logs for workout generation issues
3. Adjust backup workouts based on user feedback
4. Fine-tune validation rules as needed

