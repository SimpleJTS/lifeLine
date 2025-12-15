#!/bin/bash

# 生产模式：构建前端 + 启动后端（后端提供静态文件）

echo "=========================================="
echo "Production Mode - Building & Starting..."
echo "=========================================="

# 构建前端
echo ""
echo "[1/2] Building frontend..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed!"
    exit 1
fi

echo "✓ Frontend build complete"

# 启动后台服务
echo ""
echo "[2/2] Starting server in background..."
nohup node server/index.js > lifeLine.log 2>&1 &

# 获取进程ID
PID=$!
echo $PID > lifeLine.pid

sleep 1

# 检查进程是否还在运行
if kill -0 $PID 2>/dev/null; then
    echo ""
    echo "=========================================="
    echo "✓ Server started successfully!"
    echo "=========================================="
    echo "PID:    $PID"
    echo "Port:   ${PORT:-3000}"
    echo "Access: http://YOUR_SERVER_IP:${PORT:-3000}"
    echo ""
    echo "View logs: tail -f lifeLine.log"
    echo "Stop:      ./stop-bg.sh"
    echo "=========================================="
else
    echo "❌ Server failed to start. Check lifeLine.log for details."
    exit 1
fi
