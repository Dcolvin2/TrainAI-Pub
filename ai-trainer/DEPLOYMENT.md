# Deployment Guide

## Option 1: Vercel (Recommended for Next.js)

Vercel is the company behind Next.js and provides the best deployment experience.

### Steps:
1. Go to https://vercel.com/
2. Sign up/login with your GitHub account
3. Click "New Project"
4. Import your repository
5. Vercel will automatically detect it's a Next.js project
6. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
7. Click "Deploy"

Your app will be available at: `https://your-project-name.vercel.app`

## Option 2: Netlify

### Steps:
1. Go to https://app.netlify.com/
2. Sign up/login with your GitHub account
3. Click "New site from Git"
4. Choose your repository
5. Set build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
6. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
7. Click "Deploy site"

Your app will be available at: `https://your-site-name.netlify.app`

## Environment Variables

You'll need to add these environment variables in your deployment platform:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Benefits of Cloud Deployment

✅ **Always Online**: Your app is available 24/7
✅ **No Computer Required**: Works even when your computer is off
✅ **Global CDN**: Fast loading from anywhere in the world
✅ **Automatic Updates**: Deploy new versions with git push
✅ **SSL Certificate**: Secure HTTPS connection
✅ **Custom Domain**: Use your own domain name

## Local Development

For local development, you can still use:
```bash
npm run dev
```

This will run on `http://localhost:3000` 