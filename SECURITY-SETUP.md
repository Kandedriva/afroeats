# 🔐 Security Setup Guide

## ⚠️ CRITICAL: Environment Files Security

### Files That Contain Sensitive Data (NEVER COMMIT):
- `backend/.env.production` - Production database credentials, session secrets
- `afro-eats/.env` - Development API configuration  
- `afro-eats/.env.production` - Production API configuration

### Safe Template Files (OK to commit):
- `backend/.env.production.example` - Template with placeholder values
- `afro-eats/.env.example` - Development template

## 🛡️ Security Setup Steps

### 1. Generate Secure Session Secret
```bash
# Generate a 32-character secure random string
openssl rand -base64 32
```

### 2. Configure Production Environment
```bash
# Copy template and edit with real values
cp backend/.env.production.example backend/.env.production
# Edit with your actual database credentials
```

### 3. Set Secure File Permissions
```bash
chmod 600 backend/.env.production
chmod 600 afro-eats/.env
chmod 600 afro-eats/.env.production
```

### 4. Use Hosting Platform Environment Variables
Instead of uploading .env files, use your hosting platform's environment variable settings:

**For Render.com:**
1. Go to your service dashboard
2. Navigate to "Environment" tab
3. Add each variable individually

**For Vercel/Netlify:**
1. Project settings → Environment Variables
2. Add production variables

## 🚨 What to Replace in .env.production

### Database (CRITICAL):
```bash
PGUSER=your_actual_database_user
PGPASSWORD=your_actual_database_password
PGHOST=your_actual_database_host
PGDATABASE=your_actual_database_name
```

### Session Secret (CRITICAL):
```bash
SESSION_SECRET=result_from_openssl_rand_command
```

## 🔄 Security Rotation Schedule

1. **Monthly**: Rotate session secrets
2. **Quarterly**: Review database access logs
3. **Immediately**: If any credential is compromised

## ✅ Security Checklist

- [ ] .env files are in .gitignore
- [ ] No sensitive data in git repository
- [ ] Secure file permissions set (600)
- [ ] Production uses hosting platform environment variables
- [ ] Session secret generated with openssl
- [ ] Database credentials are unique for production
- [ ] Regular security reviews scheduled

## 🚨 Emergency Response

If sensitive data was accidentally committed:
1. Immediately rotate all credentials
2. Change database passwords
3. Generate new session secret
4. Review git history and remove sensitive commits
5. Check logs for unauthorized access