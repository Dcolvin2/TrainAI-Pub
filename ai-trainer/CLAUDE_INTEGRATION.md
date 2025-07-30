# Claude AI Integration

This document describes the separate Claude AI chat system that runs alongside the existing OpenAI system.

## 🏗️ Architecture

### New Files Created:
- `app/api/claude-workout-chat/route.ts` - Claude API endpoint
- `app/components/ClaudeChatPanel.tsx` - Claude chat component
- `app/claude-test/page.tsx` - Test page for Claude system
- `swap-to-claude.sh` - Script to switch to Claude
- `swap-to-openai.sh` - Script to revert to OpenAI

### Preserved Systems:
- ✅ All Supabase database interactions
- ✅ All workout tracking and progression
- ✅ All UI/UX and design system
- ✅ All existing API endpoints
- ✅ All authentication and user management

## 🔄 How to Switch Between Systems

### Test Claude System:
```bash
# Visit the test page
http://localhost:3000/claude-test
```

### Switch to Claude (Production):
```bash
./swap-to-claude.sh
```

### Revert to OpenAI:
```bash
./swap-to-openai.sh
```

## 🧠 Claude Features

### API Integration:
- Uses Claude 3.5 Sonnet (`claude-3-5-sonnet-20241022`)
- Fetches user context from Supabase
- Handles instruction lookups
- Supports day-of-week workout requests

### Chat Features:
- Voice input support
- Real-time transcription
- Workout plan generation
- Exercise instruction lookup
- Workout tracking and logging

### Database Integration:
- Saves workout sessions
- Tracks workout sets
- Maintains user progress
- Preserves all existing data

## 🔧 Configuration

### Environment Variables:
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...  # Claude API key
```

### VS Code Settings:
```json
{
  "cursor.cpp.model": "claude-3.5-sonnet",
  "cursor.chat.model": "claude-3.5-sonnet"
}
```

## 🧪 Testing

### Test the Claude System:
1. Start your development server
2. Visit `/claude-test`
3. Try asking for workout plans
4. Test voice input
5. Verify database saves

### Compare Responses:
- Ask the same questions to both systems
- Compare response quality and speed
- Test workout plan generation
- Verify instruction lookups

## 📊 Performance Comparison

### Claude Advantages:
- More detailed responses
- Better context understanding
- Improved instruction clarity
- Enhanced workout explanations

### OpenAI Advantages:
- Faster response times
- Lower cost per request
- Established integration
- Function calling support

## 🔄 Migration Strategy

### Phase 1: Parallel Testing ✅
- Both systems run independently
- Test Claude on `/claude-test`
- Compare functionality and performance

### Phase 2: Gradual Switch
- Use swap scripts to switch between systems
- Monitor user feedback
- Compare response quality

### Phase 3: Full Migration (Optional)
- Choose the better performing system
- Update all references
- Remove unused code

## 🛠️ Troubleshooting

### Common Issues:
1. **Claude API errors**: Check `ANTHROPIC_API_KEY` in `.env.local`
2. **Speech recognition**: Ensure HTTPS/Chrome/Safari
3. **Database errors**: Verify Supabase connection
4. **Component errors**: Check TypeScript compilation

### Debug Commands:
```bash
# Check API keys
cat .env.local | grep ANTHROPIC

# Test Claude API
curl -X POST http://localhost:3000/api/claude-workout-chat \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","messages":[{"role":"user","content":"hello"}]}'

# View logs
tail -f .next/server.log
```

## 📝 Notes

- The Claude system is completely separate from the OpenAI system
- All existing functionality is preserved
- Database schema remains unchanged
- UI/UX is identical between systems
- Easy to switch back and forth for comparison

This approach preserves 95% of your existing work while allowing you to experiment with Claude's capabilities. 