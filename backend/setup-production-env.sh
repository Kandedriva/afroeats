#!/bin/bash

# Production Environment Setup Script
echo "🔧 Setting up Production Environment Configuration"

# Check if .env.production exists
if [ -f ".env.production" ]; then
    echo "⚠️  .env.production already exists. Creating backup..."
    cp .env.production .env.production.backup.$(date +%Y%m%d_%H%M%S)
fi

# Generate secure session secret
echo "🔐 Generating secure session secret..."
SESSION_SECRET=$(openssl rand -base64 32)

echo "📝 Creating .env.production file..."

cat > .env.production << EOF
# Production Environment Configuration
NODE_ENV=production

# Session Configuration
SESSION_SECRET=${SESSION_SECRET}
SESSION_TIMEOUT=31536000000

# CORS Origins
FRONTEND_URL=https://orderdabaly.com
CLIENT_URL=https://app.orderdabaly.com
ADMIN_URL=https://admin.orderdabaly.com

# Database Configuration - UPDATE THESE VALUES!
PGUSER=your_database_user
PGPASSWORD=your_database_password  
PGHOST=your_database_host
PGDATABASE=your_database_name
PGPORT=5432

# Database Pool Settings
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# Security Settings
BCRYPT_ROUNDS=12

# Rate Limiting
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME_MINUTES=15

# Server Configuration
PORT=5001

# Debugging (set to true temporarily if having issues)
DEBUG_SESSIONS=false
EOF

echo "✅ .env.production created successfully!"
echo ""
echo "🚨 IMPORTANT: You still need to update the following values:"
echo "   - PGUSER (your database username)"
echo "   - PGPASSWORD (your database password)"
echo "   - PGHOST (your database host)"
echo "   - PGDATABASE (your database name)"
echo ""
echo "💡 Session secret has been auto-generated securely."
echo "🔒 Keep this file secure and never commit it to version control!"