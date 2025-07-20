#!/bin/bash

echo "🚀 Deploying to Netlify..."

# Build the project
echo "📦 Building the project..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Go to https://app.netlify.com/"
    echo "2. Sign up/login with your GitHub account"
    echo "3. Click 'New site from Git'"
    echo "4. Choose your repository"
    echo "5. Set build command: npm run build"
    echo "6. Set publish directory: out"
    echo "7. Add environment variables:"
    echo "   - NEXT_PUBLIC_SUPABASE_URL"
    echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo ""
    echo "🌐 Your app will be available at: https://your-app-name.netlify.app"
else
    echo "❌ Build failed!"
    exit 1
fi 