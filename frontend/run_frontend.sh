#!/bin/bash
echo "Starting ERP Frontend (Vite)..."
echo ""
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:8000"
echo ""
cd "$(dirname "$0")"
npm run dev
