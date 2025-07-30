#!/bin/bash

echo "🔄 Reverting to OpenAI System..."

# Restore the original chat component
echo "📦 Restoring original WorkoutChatBuilder..."
cp app/components/WorkoutChatBuilder.tsx.backup app/components/WorkoutChatBuilder.tsx

# Update the API endpoint reference back to OpenAI
echo "🔧 Updating API endpoint to OpenAI..."
sed -i '' 's|/api/workoutChat|/api/claude-workout-chat|g' app/components/WorkoutChatBuilder.tsx

echo "✅ Revert complete! OpenAI is now active."
echo "🔄 To switch back to Claude: ./swap-to-claude.sh" 