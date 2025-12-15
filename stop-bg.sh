#!/bin/bash

echo "Stopping servers..."

STOPPED=0

# 停止生产模式服务器
if [ -f lifeLine.pid ]; then
    PID=$(cat lifeLine.pid)
    echo "Stopping production server (PID: $PID)..."
    kill $PID 2>/dev/null && echo "✓ Production server stopped"
    rm lifeLine.pid
    STOPPED=1
fi

# 停止开发模式后端
if [ -f backend.pid ]; then
    PID=$(cat backend.pid)
    echo "Stopping backend server (PID: $PID)..."
    kill $PID 2>/dev/null && echo "✓ Backend server stopped"
    rm backend.pid
    STOPPED=1
fi

# 停止开发模式前端
if [ -f frontend.pid ]; then
    PID=$(cat frontend.pid)
    echo "Stopping frontend server (PID: $PID)..."
    kill $PID 2>/dev/null && echo "✓ Frontend server stopped"
    rm frontend.pid
    STOPPED=1
fi

# 如果没有找到 PID 文件，尝试查找并停止进程
if [ $STOPPED -eq 0 ]; then
    echo "No PID files found. Searching for running processes..."
    pkill -f "node server/index.js" && echo "✓ Backend processes stopped"
    pkill -f "vite" && echo "✓ Vite processes stopped"
fi

echo ""
echo "✓ All servers stopped"
