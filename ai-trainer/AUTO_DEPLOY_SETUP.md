# 🚀 Automatic Deployment Setup

Your app will now automatically deploy to Vercel every time you push changes to the main branch!

## Quick Setup

1. **Run the setup script:**
   ```bash
   cd ai-trainer
   ./setup-auto-deploy.sh
   ```

2. **Follow the interactive prompts** to configure your Vercel deployment

## Manual Setup (Alternative)

If you prefer to set it up manually:

### 1. Get Vercel Project Info

```bash
# Install Vercel CLI if you haven't
npm install -g vercel

# Login to Vercel
vercel login

# Link your project (if not already linked)
vercel link

# Get project info
vercel project ls
```

### 2. Get Required Tokens and IDs

1. **Vercel Token:**
   - Go to https://vercel.com/account/tokens
   - Create a new token with 'Full Account' scope
   - Copy the token

2. **Organization ID:**
   ```bash
   vercel teams ls
   ```

3. **Project ID:**
   ```bash
   vercel project ls
   ```

### 3. Add GitHub Secrets

Go to your GitHub repository:
`https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions`

Add these secrets:
- `VERCEL_TOKEN` - Your Vercel token
- `VERCEL_ORG_ID` - Your organization ID
- `VERCEL_PROJECT_ID` - Your project ID

Also ensure these environment secrets are set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

## How It Works

### GitHub Actions Workflow

The `.github/workflows/deploy.yml` file:

1. **Triggers on:**
   - Push to `main` branch
   - Pull requests to `main` branch

2. **Runs:**
   - Linting checks
   - TypeScript type checking
   - Build process
   - **Deployment to Vercel** (only on main branch)

3. **Safety:**
   - Only deploys from `main` branch
   - Runs tests on pull requests
   - Uses production environment variables

### Deployment Process

1. **Code Push** → GitHub Actions triggers
2. **Tests Run** → Lint, type-check, build
3. **Deploy** → Vercel receives the build
4. **Live** → Your app is updated automatically

## Monitoring

### Check Deployment Status

```bash
# View recent deployments
vercel ls --limit 5

# Check current status
vercel ls
```

### GitHub Actions

- **Actions Tab:** https://github.com/YOUR_USERNAME/YOUR_REPO/actions
- **Deployment Logs:** Click on any workflow run to see detailed logs

### Vercel Dashboard

- **Dashboard:** https://vercel.com/dashboard
- **Project Overview:** See deployment history and performance

## Troubleshooting

### Common Issues

1. **Build Fails:**
   - Check GitHub Actions logs
   - Ensure all environment variables are set
   - Verify TypeScript compilation

2. **Deployment Fails:**
   - Verify Vercel tokens are correct
   - Check Vercel project is linked
   - Ensure you have proper permissions

3. **Environment Variables Missing:**
   - Add all required secrets to GitHub
   - Verify they're being used in the workflow

### Manual Deployment

If automatic deployment isn't working:

```bash
# Deploy manually
vercel --prod

# Or from the ai-trainer directory
cd ai-trainer
vercel --prod
```

## Benefits

✅ **Zero Manual Work** - Deploy with every push  
✅ **Always Up-to-Date** - Latest code is always live  
✅ **Safe Deployments** - Tests run before deployment  
✅ **Rollback Ready** - Vercel keeps deployment history  
✅ **Global CDN** - Fast loading worldwide  
✅ **SSL Certificate** - Secure HTTPS by default  

## Next Steps

1. **Test the setup:**
   ```bash
   git add .
   git commit -m "Test auto-deploy"
   git push origin main
   ```

2. **Monitor the deployment:**
   - Check GitHub Actions tab
   - Verify your app is updated

3. **Customize if needed:**
   - Modify `.github/workflows/deploy.yml` for custom behavior
   - Add additional deployment environments (staging, etc.)

---

🎉 **You're all set!** Every time you push to main, your app will automatically deploy to Vercel.
