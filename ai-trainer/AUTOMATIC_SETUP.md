# 🛡️ Local Pre-Check Setup

## How It Works

The git hooks are set up locally for development, with CI/CD handling production checks:

### 1. **Local Development Setup** (Manual)
Run once per developer:
```bash
npm run setup-hooks
```

This will:
- Install husky and lint-staged
- Initialize git hooks
- Test the setup
- Make hooks executable

### 2. **GitHub Actions** (Automatic)
Every push and pull request automatically:
- Runs ESLint, TypeScript, and build checks
- Ensures code quality without git hooks
- Provides fast feedback

### 3. **Manual Setup** (Alternative)
If you prefer manual setup:
```bash
chmod +x setup-git-hooks.sh
./setup-git-hooks.sh
```

## What Happens on Every Commit

The pre-commit hook automatically runs:

1. **ESLint on staged files** (auto-fixes what it can)
2. **ESLint on entire project** (catches all issues)
3. **TypeScript type checking**
4. **Full build verification**

If any step fails, the commit is blocked with helpful error messages.

## Commands Available

```bash
# Auto-fix ESLint issues
npm run auto-fix

# Pre-deployment check
npm run pre-deploy

# Manual lint fix
npm run lint:fix

# Type checking
npm run type-check
```

## Troubleshooting

### If hooks aren't working:
```bash
# Run the setup command
npm run setup-hooks

# Or run setup manually
./setup-git-hooks.sh
```

### Vercel Deployment Issues:
Git hooks are now only set up locally, so Vercel deployments won't have any issues. The CI/CD pipeline handles quality checks in production.

### If you get permission errors:
```bash
chmod +x .husky/pre-commit
chmod +x setup-git-hooks.sh
```

## Benefits

- ✅ **Clean deployments** - no git hooks in production builds
- ✅ **Local protection** - git hooks only where needed (development)
- ✅ **CI/CD quality checks** - automated testing in production
- ✅ **Fast feedback** - catch issues before they reach deployment
- ✅ **Simple setup** - one command per developer 