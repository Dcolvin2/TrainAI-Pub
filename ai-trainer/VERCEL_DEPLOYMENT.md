# Deploy to Vercel (Recommended)

## Why Vercel?
- ✅ **Perfect for Next.js** - Made by the same company
- ✅ **Automatic deployments** - Deploys on every git push
- ✅ **Server-side rendering** - Full Next.js support
- ✅ **Free tier** - No cost to get started
- ✅ **Global CDN** - Fast loading worldwide

## Quick Steps:

### 1. Go to Vercel
Visit: https://vercel.com/

### 2. Sign Up/Login
- Use your GitHub account
- Vercel will automatically connect to your repositories

### 3. Import Your Project
- Click **"New Project"**
- Select your **TrainAI-Pub** repository
- Vercel will auto-detect it's a Next.js project

### 4. Configure Build Settings
- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: `ai-trainer`
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)

### 5. Add Environment Variables
Add these in the **Environment Variables** section:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://your-project.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your-anon-key-here`

### 6. Deploy
- Click **"Deploy"**
- Wait 2-3 minutes for build to complete

## Your URL
Your app will be available at: `https://your-project-name.vercel.app`

## Benefits Over Netlify
- ✅ Better Next.js support
- ✅ No configuration needed
- ✅ Automatic optimization
- ✅ Built-in analytics
- ✅ Edge functions support

## Next Steps After Deployment
1. Update Supabase Auth URLs to include your Vercel domain
2. Test login/signup functionality
3. Customize your domain if needed 