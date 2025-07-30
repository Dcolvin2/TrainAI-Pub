# Environment Variables Setup

## Step 1: Create `.env.local` file

Create a file named `.env.local` in the project root (same level as `package.json`) with the following content:

```bash
# Anthropic API Key
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# Model Name (for UI display)
MODEL_NAME=Claude 3.5 Sonnet

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
SUPABASE_SERVICE_KEY=your-supabase-service-role-key-here
```

## Step 2: Get Your Supabase Keys

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy these values:
   - **Project URL**: Replace `https://your-project-ref.supabase.co`
   - **Anon Key**: Replace `your-supabase-anon-key-here`
   - **Service Role Key**: Replace `your-supabase-service-role-key-here`

## Step 3: Install Dependencies

```bash
npm install @anthropic-ai/sdk
```

## Step 4: Create Database Tables

Run these SQL commands in your Supabase SQL editor:

### Equipment Table:
```sql
CREATE TABLE equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### User Goals Table:
```sql
CREATE TABLE user_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Step 5: Restart Development Server

```bash
npm run dev
```

## Step 6: Test the Setup

1. The API route will log environment variable status to the console
2. Check your terminal/console for these messages:
   - "Anthropic API Key loaded: Yes"
   - "Supabase URL loaded: Yes"
   - "Supabase Service Key loaded: Yes"

## Step 7: Remove Debug Logs

After confirming everything works, remove the console.log statements from `pages/api/generateWorkout.ts`.

## Security Notes

- ✅ `.env.local` is automatically ignored by git
- ✅ Never commit API keys to version control
- ✅ The service role key has admin privileges - keep it secure
- ✅ Environment variables are only loaded server-side

## Troubleshooting

- **"Cannot find module '@anthropic-ai/sdk'"**: Run `npm install @anthropic-ai/sdk`
- **"User ID is required"**: Ensure user is authenticated
- **"Failed to generate workout"**: Check Anthropic API key and credits
- **Empty workouts**: Add equipment and goals to the database tables
