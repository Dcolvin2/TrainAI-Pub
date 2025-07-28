#!/bin/bash

echo "🔍 Running pre-commit checks..."

# Run ESLint
echo "📝 Running ESLint..."
npm run lint
if [ $? -ne 0 ]; then
    echo "❌ ESLint found errors. Please fix them before committing."
    exit 1
fi

# Run TypeScript type check
echo "🔧 Running TypeScript type check..."
npm run type-check
if [ $? -ne 0 ]; then
    echo "❌ TypeScript found errors. Please fix them before committing."
    exit 1
fi

# Run build check
echo "🏗️ Running build check..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix errors before committing."
    exit 1
fi

echo "✅ All checks passed! Ready to commit." 