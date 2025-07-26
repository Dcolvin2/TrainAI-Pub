#!/bin/bash

echo "🚀 Setting up automatic ESLint error catching..."

# Make scripts executable
chmod +x scripts/pre-deploy.sh
chmod +x scripts/auto-fix.sh
chmod +x .husky/pre-commit

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Setup husky for git hooks
echo "🔧 Setting up git hooks..."
npx husky install 2>/dev/null || echo "Husky already installed"

# Test the setup
echo "🧪 Testing setup..."
npm run lint --silent
if [ $? -eq 0 ]; then
    echo "✅ ESLint is working"
else
    echo "⚠️  ESLint found issues. Run 'npm run auto-fix' to fix them."
fi

npm run type-check --silent
if [ $? -eq 0 ]; then
    echo "✅ TypeScript is working"
else
    echo "⚠️  TypeScript found issues. Please fix them manually."
fi

echo ""
echo "🎉 Setup complete! Now you have:"
echo ""
echo "📝 Automatic checks before commits (git hooks)"
echo "🔧 Auto-fix command: npm run auto-fix"
echo "🚀 Pre-deployment check: npm run pre-deploy"
echo "🔄 CI/CD checks on GitHub (GitHub Actions)"
echo ""
echo "💡 Your workflow:"
echo "1. Make changes"
echo "2. npm run auto-fix (if needed)"
echo "3. git add . && git commit -m 'message'"
echo "4. git push origin main"
echo ""
echo "The pre-commit hook will automatically catch errors and prevent commits with issues!" 