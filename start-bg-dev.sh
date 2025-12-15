#!/bin/bash

# 开发模式：同时后台运行前端和后端服务器

echo "Starting development servers in background..."

# 启动后端服务器
echo "Starting backend server..."
nohup node server/index.js > backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > backend.pid
echo "✓ Backend started (PID: $BACKEND_PID)"

# 等待后端启动
sleep 2

# 启动前端开发服务器
echo "Starting frontend dev server..."
nohup npm run dev:client > frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > frontend.pid
echo "✓ Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "=========================================="
echo "✓ Development servers started!"
echo "=========================================="
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Backend PID:  $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "View logs:"
echo "  Backend:  tail -f backend.log"
echo "  Frontend: tail -f frontend.log"
echo ""
echo "Stop servers: ./stop-bg.sh"
echo "=========================================="
