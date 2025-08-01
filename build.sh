#!/bin/bash

# Build script for Render deployment
# This ensures npm is used consistently

set -e

echo "🔧 Starting build process with npm..."

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

echo "📦 npm version: $(npm --version)"
echo "🟢 node version: $(node --version)"

# Determine which part to build based on context
if [ -f "backend/package.json" ] && [ -f "afro-eats/package.json" ]; then
    echo "🏗️  Building monorepo structure..."
    
    # Build backend
    echo "🔧 Installing backend dependencies..."
    cd backend
    npm ci --only=production
    cd ..
    
    # Build frontend  
    echo "🔧 Installing and building frontend..."
    cd afro-eats
    npm ci
    npm run build
    cd ..
    
elif [ -f "package.json" ]; then
    echo "🔧 Installing dependencies..."
    npm ci
    
    if grep -q "\"build\"" package.json; then
        echo "🏗️  Building application..."
        npm run build
    fi
else
    echo "❌ No package.json found"
    exit 1
fi

echo "✅ Build completed successfully!"