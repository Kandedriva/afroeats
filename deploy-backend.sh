#!/bin/bash

# Root deployment script for backend
# This ensures npm is used and handles the monorepo structure

set -e

echo "🚀 Deploying Afro Restaurant Backend..."
echo "📍 Current directory: $(pwd)"
echo "📦 npm version: $(npm --version)"
echo "🟢 node version: $(node --version)"

# Check if we're in the right place
if [ -d "backend" ]; then
    echo "✅ Found backend directory"
    cd backend
elif [ -f "server.js" ]; then
    echo "✅ Already in backend directory"
else
    echo "❌ Cannot find backend directory or server.js"
    exit 1
fi

echo "🔧 Installing backend dependencies..."
npm ci --only=production --no-audit --no-fund --package-lock-only

echo "✅ Backend deployment ready!"
echo "🚀 Starting server..."
exec npm start