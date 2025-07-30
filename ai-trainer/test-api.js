// Test script to verify API setup
require('dotenv').config({ path: '.env.local' });

console.log('=== Environment Variables Check ===');
console.log('Claude API Key:', process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Missing');
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('Supabase Service Key:', process.env.SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing');

if (process.env.SUPABASE_SERVICE_KEY === 'your-supabase-service-role-key-here') {
  console.log('\n❌ ERROR: Supabase Service Key is still set to placeholder value!');
  console.log('You need to get your actual service role key from:');
  console.log('1. Go to https://supabase.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Go to Settings → API');
  console.log('4. Copy the "service_role" key (not the anon key)');
  console.log('5. Replace the placeholder in .env.local');
} else {
  console.log('\n✅ All environment variables appear to be set correctly');
} 