#!/bin/bash

if [ -f lifeLine.pid ]; then
    PID=$(cat lifeLine.pid)
    echo "Stopping server (PID: $PID)..."
    kill $PID 2>/dev/null
    rm lifeLine.pid
    echo "✓ Server stopped"
else
    echo "Stopping all node server processes..."
    pkill -f "node server/index.js"
    echo "✓ Done"
fi
