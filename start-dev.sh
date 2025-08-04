#!/bin/bash

# Development Startup Script for Afro Restaurant App
echo "🚀 Starting Afro Restaurant App in Development Mode..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Function to kill background processes on exit
cleanup() {
    echo "🛑 Shutting down development servers..."
    kill $(jobs -p) 2>/dev/null
    exit
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

echo "📊 Starting Backend Server..."
cd backend && npm run dev &
BACKEND_PID=$!

echo "⏳ Waiting for backend to start..."
sleep 3

echo "🖥️  Starting Frontend React App..."
cd ../afro-eats && npm start &
FRONTEND_PID=$!

echo ""
echo "✅ Development servers started successfully!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔌 Backend:  http://localhost:5001"
echo "🔍 Session Debug: http://localhost:5001/api/session-debug"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for all background processes
wait