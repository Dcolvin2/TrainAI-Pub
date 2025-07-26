#!/bin/bash

echo "🔧 Setting up git hooks for automatic error catching..."

# Make sure we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're in the project root."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Install husky
echo "🔧 Installing husky..."
npm install --save-dev husky lint-staged

# Initialize husky
echo "🔧 Initializing husky..."
npx husky install

# Make the pre-commit hook executable
chmod +x .husky/pre-commit

# Test the setup
echo "🧪 Testing git hooks setup..."

# Test ESLint
echo "📝 Testing ESLint..."
npm run lint
if [ $? -eq 0 ]; then
    echo "✅ ESLint is working"
else
    echo "⚠️  ESLint found issues. Run 'npm run lint:fix' to fix them."
fi

# Test TypeScript
echo "🔧 Testing TypeScript..."
npm run type-check
if [ $? -eq 0 ]; then
    echo "✅ TypeScript is working"
else
    echo "⚠️  TypeScript found issues. Please fix them manually."
fi

# Test build
echo "🏗️ Testing build..."
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Build is working"
else
    echo "⚠️  Build found issues. Please fix them manually."
fi

echo ""
echo "🎉 Git hooks setup complete!"
echo ""
echo "Now when you commit, the following will happen automatically:"
echo "1. ESLint will check and fix code style"
echo "2. TypeScript will check for type errors"
echo "3. Build will verify everything compiles"
echo "4. If any step fails, the commit will be blocked"
echo ""
echo "To test the hooks, try making a commit:"
echo "git add . && git commit -m 'test commit'" 