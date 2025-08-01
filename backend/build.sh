#!/bin/bash

# Backend build script for Render deployment
# Explicitly uses npm to avoid Yarn conflicts

set -e

echo "🔧 Starting backend build with npm..."

# Ensure we're using npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

echo "📦 npm version: $(npm --version)"
echo "🟢 node version: $(node --version)"

# Check for package.json
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found in backend directory"
    exit 1
fi

echo "🔧 Installing dependencies with npm ci..."
npm ci --only=production --no-audit --no-fund

echo "✅ Backend build completed successfully!"
echo "🚀 Ready to start with: npm start"