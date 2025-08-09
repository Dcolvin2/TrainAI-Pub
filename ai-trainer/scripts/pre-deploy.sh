#!/bin/bash

echo "🚀 Pre-deployment checklist"
echo "=========================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're in the project root."
    exit 1
fi

echo "📝 1. Running ESLint..."
npm run lint
if [ $? -ne 0 ]; then
    echo "❌ ESLint failed. Please fix the errors above."
    exit 1
fi

echo "🔧 2. Running TypeScript type check..."
npm run type-check
if [ $? -ne 0 ]; then
    echo "❌ TypeScript type check failed. Please fix the errors above."
    exit 1
fi

echo "🏗️ 3. Running build..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix the errors above."
    exit 1
fi

echo "✅ All checks passed! Ready to deploy."
echo ""
echo "Next steps:"
echo "1. git add ."
echo "2. git commit -m 'your message'"
echo "3. git push origin main" 