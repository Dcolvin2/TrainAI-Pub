# 🚀 Deployment Checklist

## Pre-Deployment Steps

### Option 1: Automated Pre-Deployment Check
```bash
# Run the pre-deployment script
chmod +x scripts/pre-deploy.sh
./scripts/pre-deploy.sh
```

### Option 2: Manual Checks
```bash
# 1. Run ESLint
npm run lint

# 2. Run TypeScript type check
npm run type-check

# 3. Run build
npm run build
```

### Option 3: Quick Fix Commands
```bash
# Auto-fix ESLint errors
npm run lint:fix

# Check for TypeScript errors
npm run type-check
```

## Common ESLint Errors to Watch For

### 1. Unused Variables
```typescript
// ❌ Bad
const unusedVar = 'something';

// ✅ Good
const usedVar = 'something';
console.log(usedVar);
```

### 2. Unused Function Parameters
```typescript
// ❌ Bad
function myFunction(param1: string, param2: string) {
  console.log(param1); // param2 is unused
}

// ✅ Good
function myFunction(param1: string, _param2: string) {
  console.log(param1); // prefix with _ to indicate intentionally unused
}
```

### 3. Missing Imports
```typescript
// ❌ Bad
import { useState, useEffect } from 'react'; // useEffect not used

// ✅ Good
import { useState } from 'react';
```

## VS Code Setup

1. Install the ESLint extension
2. Install the TypeScript extension
3. The `.vscode/settings.json` file will automatically:
   - Show ESLint errors in real-time
   - Auto-fix on save
   - Format code on save

## Git Hooks (Optional)

If you want automatic checks before every commit:

```bash
# Install dependencies (if not already installed)
npm install

# Enable git hooks
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

## Deployment Commands

```bash
# 1. Run pre-deployment checks
./scripts/pre-deploy.sh

# 2. If all checks pass, commit and push
git add .
git commit -m "your commit message"
git push origin main
```

## Troubleshooting

### If ESLint fails:
1. Run `npm run lint:fix` to auto-fix issues
2. Manually fix any remaining errors
3. Run `npm run lint` again to verify

### If TypeScript fails:
1. Check for missing type definitions
2. Add proper type annotations
3. Run `npm run type-check` again

### If build fails:
1. Check for missing dependencies
2. Verify all imports are correct
3. Run `npm run build` again 