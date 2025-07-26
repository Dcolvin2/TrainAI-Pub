#!/bin/bash

# Automated git hooks setup - runs silently
echo "🔧 Setting up git hooks automatically..."

# Make sure we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're in the project root."
    exit 1
fi

# Install husky if not already installed
if [ ! -d "node_modules/husky" ]; then
    echo "📦 Installing husky..."
    npm install --save-dev husky lint-staged --silent
fi

# Initialize husky (only if git repo exists)
if [ -d ".git" ]; then
    echo "🔧 Initializing husky..."
    npx husky install --silent
else
    echo "⚠️  Skipping husky install (no git repository)"
    exit 0
fi

# Make the pre-commit hook executable
chmod +x .husky/pre-commit 2>/dev/null || true

# Test the setup silently
echo "🧪 Testing setup..."

# Test ESLint
npm run lint --silent > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ ESLint: OK"
else
    echo "⚠️  ESLint: Issues found (run 'npm run lint:fix' to fix)"
fi

# Test TypeScript
npm run type-check --silent > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ TypeScript: OK"
else
    echo "⚠️  TypeScript: Issues found"
fi

# Test build
npm run build --silent > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Build: OK"
else
    echo "⚠️  Build: Issues found"
fi

echo "🎉 Git hooks setup complete!"
echo "💡 Commits will now automatically check for errors." 