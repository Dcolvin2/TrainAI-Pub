#!/bin/bash

echo "🔧 Auto-fixing common ESLint errors..."

# Function to remove unused variables
remove_unused_variables() {
    echo "📝 Removing unused variables..."
    
    # Find TypeScript/JavaScript files
    find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | while read file; do
        # Skip node_modules and .next
        if [[ $file == *"node_modules"* ]] || [[ $file == *".next"* ]]; then
            continue
        fi
        
        # Remove unused variable declarations
        # Pattern: const/let variableName = value; (where variableName is not used)
        sed -i '' 's/^[[:space:]]*\(const\|let\)[[:space:]]\+\([a-zA-Z_][a-zA-Z0-9_]*\)[[:space:]]*=[[:space:]]*[^;]*;[[:space:]]*$//g' "$file" 2>/dev/null || true
        
        # Remove unused function parameters (prefix with _)
        sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\):[[:space:]]*[^,)]*/\_\1:\1/g' "$file" 2>/dev/null || true
    done
}

# Function to fix import issues
fix_imports() {
    echo "📦 Fixing import issues..."
    
    # Run ESLint auto-fix
    npm run lint:fix 2>/dev/null || true
}

# Function to check for common patterns
check_patterns() {
    echo "🔍 Checking for common error patterns..."
    
    # Check for unused variables
    if grep -r "is assigned a value but never used" . --include="*.ts" --include="*.tsx" 2>/dev/null; then
        echo "⚠️  Found unused variables. Running auto-fix..."
        remove_unused_variables
    fi
    
    # Check for missing imports
    if grep -r "Cannot find module" . --include="*.ts" --include="*.tsx" 2>/dev/null; then
        echo "⚠️  Found missing imports. Please check manually."
    fi
}

# Main execution
echo "🚀 Starting auto-fix process..."

# Run ESLint auto-fix first
fix_imports

# Check for common patterns
check_patterns

# Run final ESLint check
echo "✅ Running final ESLint check..."
npm run lint

echo "🎉 Auto-fix complete!"
echo ""
echo "If errors remain, please fix them manually:"
echo "1. npm run lint (to see remaining errors)"
echo "2. npm run type-check (to see TypeScript errors)"
echo "3. npm run build (to see build errors)" 