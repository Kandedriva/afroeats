#!/bin/bash

# OrderDabaly Development Environment Startup Script
# This script starts both frontend and backend development servers

echo "🚀 Starting OrderDabaly Development Environment..."

# Kill any existing processes on ports 3000 and 5001
echo "🧹 Cleaning up any existing processes..."
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "react-scripts start" 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:5001 | xargs kill -9 2>/dev/null || true

# Wait a moment for ports to be freed
sleep 3
echo "🔍 Checking if ports are free..."
if lsof -ti:5001 >/dev/null 2>&1; then
    echo "❌ Port 5001 is still in use. Please manually kill the process and try again."
    exit 1
fi
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "❌ Port 3000 is still in use. Please manually kill the process and try again."
    exit 1
fi
echo "✅ Ports are free"

echo "📡 Starting backend server on port 5001..."
cd backend
npm start &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 5

# Check if backend is running
if curl -s http://localhost:5001/api/health >/dev/null; then
    echo "✅ Backend is running successfully!"
else
    echo "❌ Backend failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo "🖥️  Starting frontend server on port 3000..."
cd ../afro-eats
npm start &
FRONTEND_PID=$!

echo ""
echo "🎉 Development environment started successfully!"
echo ""
echo "📊 Services:"
echo "  Frontend: http://localhost:3000"
echo "  Backend API: http://localhost:5001"
echo "  Admin Dashboard: http://localhost:5001/api/admin"
echo "  Health Check: http://localhost:5001/api/health"
echo ""
echo "🔑 Development Configuration:"
echo "  Using TEST Stripe keys (safe for development)"
echo "  Database: Neon PostgreSQL"
echo "  Session Store: PostgreSQL"
echo ""
echo "💡 To stop both servers, press Ctrl+C"
echo ""

# Wait for frontend to start
sleep 10

# Check if frontend is running
if curl -s http://localhost:3000 >/dev/null; then
    echo "✅ Frontend is running successfully!"
    echo "🌐 You can now open http://localhost:3000 in your browser"
else
    echo "⚠️  Frontend might still be starting up..."
    echo "🌐 Try opening http://localhost:3000 in your browser in a few moments"
fi

# Keep script running and handle cleanup
cleanup() {
    echo ""
    echo "🛑 Shutting down development servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo "✅ Development servers stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Keep the script running
wait