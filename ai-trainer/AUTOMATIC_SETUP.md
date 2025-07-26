# 🤖 Automatic Git Hooks Setup

## How It Works

The git hooks are now set up automatically in several ways:

### 1. **Post-Install Script** (Automatic)
When you run `npm install`, the `postinstall` script automatically:
- Installs husky and lint-staged
- Initializes git hooks
- Tests the setup
- Makes hooks executable

### 2. **GitHub Actions** (Automatic)
Every push and pull request automatically:
- Runs the setup script
- Tests ESLint, TypeScript, and build
- Ensures code quality

### 3. **Manual Setup** (Optional)
If you need to run it manually:
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
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Or run setup manually
./setup-git-hooks.sh
```

### Vercel Deployment Issues:
The git hooks setup is automatically skipped in Vercel's build environment (no git repo). This is normal and expected.

If you see build errors related to husky, the fix is already in place:
- `vercel.json` uses custom build commands
- `package.json` scripts check for git repo before running
- Build process skips git hooks setup automatically

### If you get permission errors:
```bash
chmod +x .husky/pre-commit
chmod +x setup-git-hooks-auto.sh
```

## Benefits

- ✅ **No more deployment failures** due to ESLint errors
- ✅ **Automatic setup** - no manual configuration needed
- ✅ **Consistent code quality** across all commits
- ✅ **Fast feedback** - catch issues before they reach deployment 