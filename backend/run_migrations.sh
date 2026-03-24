#!/bin/bash
echo "Running ERP Django Migrations..."
cd "$(dirname "$0")"
source venv/Scripts/activate
export DJANGO_SETTINGS_MODULE=config.settings.development
python manage.py makemigrations
python manage.py migrate
echo "Migrations complete!"
