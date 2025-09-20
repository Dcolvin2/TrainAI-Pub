// Test script to verify OpenAI integration
// Run with: node test-openai-integration.js

const { openaiJSON, chatOpenAI } = require('./lib/openaiClient.ts');

async function testOpenAIIntegration() {
  console.log('🧪 Testing OpenAI Integration...\n');
  
  // Test 1: Basic chat functionality
  console.log('1. Testing basic chat...');
  try {
    const response = await chatOpenAI('Say "OpenAI integration working!"', {
      model: 'gpt-4o',
      max_tokens: 50,
      temperature: 0
    });
    console.log('✅ Basic chat:', response);
  } catch (error) {
    console.log('❌ Basic chat failed:', error.message);
  }
  
  // Test 2: JSON output functionality
  console.log('\n2. Testing JSON output...');
  try {
    const jsonResponse = await openaiJSON(
      'You are a fitness coach. Return a simple workout plan as JSON.',
      { request: 'Create a simple 5-minute warmup' },
      { model: 'gpt-4o', max_tokens: 200, temperature: 0 }
    );
    console.log('✅ JSON output:', JSON.stringify(jsonResponse, null, 2));
  } catch (error) {
    console.log('❌ JSON output failed:', error.message);
  }
  
  console.log('\n🎉 OpenAI integration test completed!');
}

// Check environment variables
console.log('Environment Check:');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
console.log('');

if (!process.env.OPENAI_API_KEY) {
  console.log('❌ OPENAI_API_KEY environment variable is not set!');
  console.log('Please set it in your .env.local file or environment.');
  process.exit(1);
}

testOpenAIIntegration().catch(console.error);
