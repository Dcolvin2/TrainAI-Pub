#!/bin/bash

echo "🔄 Swapping to Claude AI System..."

# Backup the original chat component
echo "📦 Backing up original WorkoutChatBuilder..."
cp app/components/WorkoutChatBuilder.tsx app/components/WorkoutChatBuilder.tsx.backup

# Replace with Claude component
echo "🔄 Replacing with ClaudeChatPanel..."
cp app/components/ClaudeChatPanel.tsx app/components/WorkoutChatBuilder.tsx

# Update the API endpoint reference in the component
echo "🔧 Updating API endpoint to Claude..."
sed -i '' 's|/api/claude-workout-chat|/api/workoutChat|g' app/components/WorkoutChatBuilder.tsx

echo "✅ Swap complete! Claude AI is now active."
echo "📝 Original component backed up as WorkoutChatBuilder.tsx.backup"
echo "🔄 To revert: ./swap-to-openai.sh" 