#!/bin/bash

echo "🚀 Setting up Automatic Deployment to Vercel"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the ai-trainer directory"
    exit 1
fi

echo ""
echo "📋 Prerequisites:"
echo "1. You need a Vercel account (https://vercel.com)"
echo "2. Your project should be connected to Vercel"
echo "3. You need access to GitHub repository settings"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

echo ""
echo "🔧 Step 1: Get Vercel Project Info"
echo "-----------------------------------"
echo "Run these commands to get your Vercel project details:"
echo ""
echo "1. Login to Vercel:"
echo "   vercel login"
echo ""
echo "2. Link your project (if not already linked):"
echo "   vercel link"
echo ""
echo "3. Get your project info:"
echo "   vercel project ls"
echo ""

read -p "Press Enter when you have your Vercel project details..."

echo ""
echo "🔑 Step 2: Get Vercel Token"
echo "---------------------------"
echo "1. Go to https://vercel.com/account/tokens"
echo "2. Create a new token with 'Full Account' scope"
echo "3. Copy the token"
echo ""

read -p "Enter your Vercel token: " VERCEL_TOKEN

echo ""
echo "🏢 Step 3: Get Organization ID"
echo "-----------------------------"
echo "Run this command to get your org ID:"
echo "vercel teams ls"
echo ""

read -p "Enter your Vercel organization ID: " VERCEL_ORG_ID

echo ""
echo "📁 Step 4: Get Project ID"
echo "-------------------------"
echo "Run this command to get your project ID:"
echo "vercel project ls"
echo ""

read -p "Enter your Vercel project ID: " VERCEL_PROJECT_ID

echo ""
echo "🔐 Step 5: Add GitHub Secrets"
echo "-----------------------------"
echo "Go to your GitHub repository:"
echo "https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions"
echo ""
echo "Add these secrets:"
echo ""
echo "VERCEL_TOKEN: $VERCEL_TOKEN"
echo "VERCEL_ORG_ID: $VERCEL_ORG_ID"
echo "VERCEL_PROJECT_ID: $VERCEL_PROJECT_ID"
echo ""
echo "Also ensure these environment secrets are set:"
echo "- NEXT_PUBLIC_SUPABASE_URL"
echo "- NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "- SUPABASE_SERVICE_ROLE_KEY"
echo "- OPENAI_API_KEY"
echo "- ANTHROPIC_API_KEY"
echo ""

read -p "Press Enter when you've added all the secrets..."

echo ""
echo "✅ Setup Complete!"
echo "=================="
echo ""
echo "🎉 Your automatic deployment is now configured!"
echo ""
echo "📝 What happens now:"
echo "- Every push to the 'main' branch will trigger a deployment"
echo "- Pull requests will run tests but won't deploy"
echo "- Deployments will only happen on the main branch"
echo ""
echo "🚀 To test it:"
echo "1. Make a small change to your code"
echo "2. Commit and push to main:"
echo "   git add ."
echo "   git commit -m 'Test auto-deploy'"
echo "   git push origin main"
echo "3. Check the Actions tab in GitHub to see the deployment"
echo "4. Your app will be live at your Vercel URL"
echo ""
echo "📊 Monitor deployments:"
echo "- GitHub Actions: https://github.com/YOUR_USERNAME/YOUR_REPO/actions"
echo "- Vercel Dashboard: https://vercel.com/dashboard"
echo ""

echo "🎯 Quick Commands:"
echo "------------------"
echo "Check deployment status:"
echo "  vercel ls"
echo ""
echo "View recent deployments:"
echo "  vercel ls --limit 5"
echo ""
echo "Redeploy manually:"
echo "  vercel --prod"
echo ""

