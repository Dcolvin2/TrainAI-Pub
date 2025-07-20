#!/bin/bash

echo "🔧 Setting up environment variables for deployment..."
echo ""

echo "📋 You'll need these environment variables for your deployment:"
echo ""
echo "NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here"
echo ""

echo "🌐 To get these values:"
echo "1. Go to https://supabase.com/dashboard"
echo "2. Select your project"
echo "3. Go to Settings > API"
echo "4. Copy the 'Project URL' and 'anon public' key"
echo ""

echo "🚀 Deployment Options:"
echo ""
echo "Option 1 - Vercel (Recommended):"
echo "  https://vercel.com/"
echo "  - Best for Next.js apps"
echo "  - Automatic deployment from Git"
echo "  - Free tier available"
echo ""
echo "Option 2 - Netlify:"
echo "  https://app.netlify.com/"
echo "  - Also great for Next.js"
echo "  - Free tier available"
echo "  - Custom domains supported"
echo ""

echo "✅ Once deployed, your app will be available 24/7 without needing your computer on!" 