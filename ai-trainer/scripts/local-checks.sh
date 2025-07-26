#!/bin/bash

echo "🔍 Running local pre-checks..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're in the project root."
    exit 1
fi

# Run ESLint
echo "📝 Running ESLint..."
npm run lint
if [ $? -ne 0 ]; then
    echo "❌ ESLint failed. Please fix the errors above."
    exit 1
fi

# Run TypeScript type check
echo "🔧 Running TypeScript type check..."
npm run type-check
if [ $? -ne 0 ]; then
    echo "❌ TypeScript type check failed. Please fix the errors above."
    exit 1
fi

# Run build check
echo "🏗️ Running build check..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix the errors above."
    exit 1
fi

echo "✅ All checks passed! Ready to commit." 