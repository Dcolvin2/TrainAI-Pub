# 🧪 Claude Integration Testing Guide

## 🚀 **Quick Start Options**

### **Option 1: Deploy to Vercel (Recommended)**
Since npm isn't available locally, deploy to Vercel for testing:

```bash
# Deploy the claude-integration branch
vercel --prod

# Your app will be available at: https://your-app.vercel.app
# Test Claude at: https://your-app.vercel.app/claude-test
```

### **Option 2: Local Development (if you install Node.js)**
```bash
# Install Node.js from https://nodejs.org/
npm install
npm run dev

# Visit: http://localhost:3000/claude-test
```

### **Option 3: Direct API Testing**
Test the Claude API endpoint directly:

```bash
# Run the test script (requires Node.js)
node test-claude-api.js
```

## 🧪 **Testing Checklist**

### **1. Environment Variables**
✅ Verify all API keys are set:
```bash
cat .env.local | grep -E "(ANTHROPIC|OPENAI|SUPABASE)"
```

### **2. Test Claude API Endpoint**
✅ Test the `/api/claude-workout-chat` endpoint:
- Should respond to basic chat messages
- Should handle instruction lookups
- Should fetch user context from Supabase

### **3. Test Claude Chat Interface**
✅ Visit `/claude-test` page:
- Chat interface loads correctly
- Voice input works
- Messages send and receive responses
- Workout tracking functions work

### **4. Compare with OpenAI System**
✅ Test both systems with same questions:
- Ask for workout plans
- Request exercise instructions
- Test voice input on both
- Compare response quality and speed

## 🔄 **Switching Between Systems**

### **Switch to Claude:**
```bash
./swap-to-claude.sh
```

### **Revert to OpenAI:**
```bash
./swap-to-openai.sh
```

## 📊 **Performance Comparison**

### **Test Questions to Ask Both Systems:**

1. **"Create a Monday workout plan"**
2. **"How do I do a barbell squat?"**
3. **"I want to build muscle, what should I focus on?"**
4. **"Create a 30-minute HIIT workout"**
5. **"What's the proper form for deadlifts?"**

### **Metrics to Compare:**
- ⚡ Response speed
- 📝 Response quality and detail
- 🎯 Accuracy of workout plans
- 💰 Cost per request
- 🔧 Functionality (voice, tracking, etc.)

## 🛠️ **Troubleshooting**

### **Common Issues:**

**1. Claude API Errors:**
```bash
# Check API key
cat .env.local | grep ANTHROPIC_API_KEY

# Test API directly
curl -X POST https://api.anthropic.com/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}'
```

**2. Supabase Connection Errors:**
```bash
# Check Supabase keys
cat .env.local | grep SUPABASE
```

**3. Component Errors:**
```bash
# Check TypeScript compilation
npx tsc --noEmit
```

### **Debug Commands:**
```bash
# Test Claude API endpoint
node test-claude-api.js

# Check environment variables
cat .env.local

# View deployment logs
vercel logs
```

## 🎯 **Success Criteria**

### **Claude System Should:**
✅ Respond to chat messages
✅ Generate workout plans
✅ Provide exercise instructions
✅ Handle voice input
✅ Save workout data to Supabase
✅ Maintain user context
✅ Work with existing UI components

### **Performance Targets:**
- Response time: < 5 seconds
- API success rate: > 95%
- Voice recognition: Works in Chrome/Safari
- Database saves: All workout data persists

## 📝 **Testing Notes**

### **Before Testing:**
1. Ensure all API keys are valid
2. Deploy to Vercel or start local server
3. Have test user account ready
4. Prepare comparison questions

### **During Testing:**
1. Test both systems with same questions
2. Document response differences
3. Note any errors or issues
4. Compare user experience

### **After Testing:**
1. Choose preferred system
2. Use swap script to switch
3. Monitor performance in production
4. Gather user feedback

## 🚀 **Next Steps**

1. **Deploy to Vercel** for testing
2. **Test both systems** with real questions
3. **Compare performance** and user experience
4. **Choose preferred system** based on results
5. **Switch to preferred system** using swap scripts
6. **Monitor and optimize** based on usage

The Claude integration is ready for comprehensive testing! 🎉 