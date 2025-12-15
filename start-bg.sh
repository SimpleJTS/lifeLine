#!/bin/bash

# 构建前端
echo "Building frontend..."
npm run build

# 启动后台服务
echo "Starting server in background..."
nohup node server/index.js > lifeLine.log 2>&1 &

# 获取进程ID
PID=$!
echo $PID > lifeLine.pid

echo "✓ Server started successfully!"
echo "  PID: $PID"
echo "  Port: ${PORT:-3000}"
echo "  Access: http://YOUR_SERVER_IP:${PORT:-3000}"
echo ""
echo "To view logs: tail -f lifeLine.log"
echo "To stop: ./stop-bg.sh or kill $PID"
