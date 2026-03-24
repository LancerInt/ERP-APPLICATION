#!/bin/bash
echo "Starting ERP Django Development Server..."
echo ""
echo "Admin Panel: http://127.0.0.1:8000/admin/"
echo "API Docs:    http://127.0.0.1:8000/api/docs/"
echo "API Schema:  http://127.0.0.1:8000/api/schema/"
echo ""

cd "$(dirname "$0")"
source venv/Scripts/activate
export DJANGO_SETTINGS_MODULE=config.settings.development
python manage.py runserver 0.0.0.0:8000
