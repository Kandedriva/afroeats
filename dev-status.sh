#!/bin/bash

# Development Environment Status Checker
echo "🔍 OrderDabaly Development Environment Status"
echo "=============================================="

# Check if ports are in use
echo ""
echo "📊 Port Status:"
if lsof -ti:5001 >/dev/null 2>&1; then
    echo "  ✅ Backend (5001): Running"
    BACKEND_PID=$(lsof -ti:5001)
    echo "     PID: $BACKEND_PID"
else
    echo "  ❌ Backend (5001): Not running"
fi

if lsof -ti:3000 >/dev/null 2>&1; then
    echo "  ✅ Frontend (3000): Running"
    FRONTEND_PID=$(lsof -ti:3000)
    echo "     PID: $FRONTEND_PID"
else
    echo "  ❌ Frontend (3000): Not running"
fi

# Check API health
echo ""
echo "🏥 API Health Check:"
if curl -s http://localhost:5001/api/health >/dev/null 2>&1; then
    echo "  ✅ Backend API: Healthy"
    curl -s http://localhost:5001/api/health | jq .
else
    echo "  ❌ Backend API: Not responding"
fi

# Check frontend
echo ""
echo "🌐 Frontend Check:"
if curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo "  ✅ Frontend: Running"
    echo "  🌐 URL: http://localhost:3000"
else
    echo "  ❌ Frontend: Not responding"
fi

echo ""
echo "🚀 Quick Start Commands:"
echo "  Backend:  cd backend && npm start"
echo "  Frontend: cd afro-eats && npm start"
echo "  Both:     ./start-dev.sh"
echo ""