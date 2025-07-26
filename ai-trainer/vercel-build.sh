#!/bin/bash

# Vercel build script - skips git hooks setup
echo "🚀 Building for Vercel deployment..."

# Install dependencies without git hooks
echo "📦 Installing dependencies..."
npm ci --ignore-scripts

# Run build
echo "🏗️ Building application..."
npm run build

echo "✅ Build complete!" 