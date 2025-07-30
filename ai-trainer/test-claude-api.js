// Test Claude API endpoint directly
require('dotenv').config({ path: '.env.local' });

async function testClaudeAPI() {
  console.log('🧪 Testing Claude API endpoint...');
  
  const testData = {
    userId: 'test-user-123',
    messages: [
      { role: 'user', content: 'Hello! Can you help me create a workout plan?' }
    ]
  };

  try {
    // Test the API endpoint
    const response = await fetch('http://localhost:3000/api/claude-workout-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Claude API test successful!');
      console.log('Response:', data.assistantMessage);
    } else {
      console.log('❌ Claude API test failed');
      console.log('Status:', response.status);
      console.log('Error:', data.error);
    }
  } catch (error) {
    console.log('❌ Connection error:', error.message);
    console.log('💡 Make sure your dev server is running on localhost:3000');
  }
}

// Check environment variables
console.log('🔑 Environment Check:');
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Missing');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing');

testClaudeAPI(); 