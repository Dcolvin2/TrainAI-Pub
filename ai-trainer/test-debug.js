// test-debug.js - Simple test for the debugging system
const fetch = require('node-fetch');

async function testDebugWorkout() {
  console.log('🧪 Testing workout generation with debug...');
  
  try {
    const response = await fetch('http://localhost:3000/api/chat-workout?user=test-user&split=push&minutes=45', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: 'I want a push workout',
        userId: 'test-user'
      })
    });

    const data = await response.json();
    
    console.log('✅ Response received');
    console.log('📊 Status:', response.status);
    console.log('🔍 Debug info:', data.debug);
    console.log('📝 Name:', data.name);
    console.log('💪 Workout has content:', data.workout && (
      (data.workout.warmup?.length || 0) + 
      (data.workout.main?.length || 0) + 
      (data.workout.cooldown?.length || 0) > 0
    ));
    
    if (data.debug?.parseError) {
      console.log('❌ Parse error:', data.debug.parseError);
    } else {
      console.log('✅ No parse errors');
    }
    
    if (data.debug?.validity !== 'ok') {
      console.log('⚠️  Validity issue:', data.debug.validity);
    } else {
      console.log('✅ Valid workout generated');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testDebugWorkout();
}

module.exports = { testDebugWorkout };
