@echo off
echo Running ERP Django Migrations...
cd /d "%~dp0"
call venv\Scripts\activate
set DJANGO_SETTINGS_MODULE=config.settings.development
python manage.py makemigrations
python manage.py migrate
echo Migrations complete!
pause
