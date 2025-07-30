# AI Workout Generation Setup

## Required API Keys

To use the "Generate Today's Workout" feature, you need to set up the following API keys:

### 1. OpenAI API Key
- Go to https://platform.openai.com/account/api-keys
- Create a new API key
- Copy the key (starts with `sk-`)

### 2. Supabase Service Role Key
- Go to your Supabase project dashboard
- Navigate to Settings > API
- Copy the "service_role" key (not the anon key)

## Environment Variables

Create a `.env.local` file in the root directory with:

```bash
# OpenAI API Key
OPENAI_API_KEY=your-openai-api-key-here

# Supabase Configuration (you should already have these)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-key
```

## Database Tables Required

The AI workout generation uses these Supabase tables:

### 1. `equipment` table
```sql
CREATE TABLE equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. `user_goals` table
```sql
CREATE TABLE user_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Installation Steps

1. **Install dependencies:**
   ```bash
   npm install openai
   ```

2. **Set up environment variables** (see above)

3. **Create database tables** (if they don't exist)

4. **Restart your development server:**
   ```bash
   npm run dev
   ```

## How It Works

1. User clicks "Generate Today's Workout"
2. System fetches user's equipment and goals from Supabase
3. AI generates personalized workout based on:
   - Available time (5-120 minutes)
   - User's equipment
   - User's fitness goals
   - Balanced workout structure (warm-up, main session, cool-down)

## Features

- **Time-based workouts**: Adjusts intensity based on available time
- **Equipment-aware**: Uses only equipment the user has
- **Goal-oriented**: Tailors workouts to user's fitness goals
- **Balanced structure**: Always includes warm-up, main workout, and cool-down
- **Real-time generation**: Creates fresh workouts on demand

## Troubleshooting

- **"Failed to generate workout"**: Check your OpenAI API key and credits
- **"User ID is required"**: Ensure user is properly authenticated
- **Empty workouts**: Check that equipment and goals tables have data 