#!/bin/bash

# Production Deployment Script for Afro Restaurant App
echo "🚀 Starting Production Deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Set production environment
export NODE_ENV=production

echo "📦 Building Frontend for Production..."
cd afro-eats

# Install dependencies
npm install

# Build with production environment
npm run build

echo "✅ Frontend build completed"

echo "🔧 Preparing Backend for Production..."
cd ../backend

# Install backend dependencies
npm install

# Run any necessary migrations or setup
echo "📊 Database setup (if needed)..."

echo "🌐 Production Configuration:"
echo "  - Frontend: https://orderdabaly.com"
echo "  - API: https://api.orderdabaly.com"
echo "  - Cookie Domain: .orderdabaly.com"
echo "  - Session: Secure, SameSite=lax"

echo "✅ Production deployment preparation complete!"
echo ""
echo "Next steps:"
echo "1. Deploy backend to your hosting service (ensure NODE_ENV=production)"
echo "2. Deploy frontend build folder to your CDN/hosting"
echo "3. Configure DNS to point api.orderdabaly.com to your backend"
echo "4. Test authentication flow"