#!/bin/bash

# Simple Development Environment Startup
echo "🚀 Starting OrderDabaly Development Environment (Simple Mode)..."

# Change to backend directory and start backend
echo "📡 Starting backend server..."
cd backend

# Start backend in background
npm start &
BACKEND_PID=$!

echo "✅ Backend started with PID: $BACKEND_PID"
echo "🌐 Backend running at: http://localhost:5001"
echo ""
echo "To start frontend, open a new terminal and run:"
echo "  cd afro-eats && npm start"
echo ""
echo "To stop backend, run:"
echo "  kill $BACKEND_PID"
echo ""

# Keep the script running
wait $BACKEND_PID