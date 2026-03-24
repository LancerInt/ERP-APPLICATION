# Lancer ERP - Quick Start Guide

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Make
- 8GB RAM, 50GB disk space

## Development Setup (5 minutes)

### 1. Initialize Environment

```bash
# Clone and navigate
cd erp_project

# Create environment files
make env-create

# Verify configuration
make env-validate
```

### 2. Start Development Stack

```bash
# Full setup (builds, starts, migrates, seeds)
make setup

# Or start manually
make dev-build
make dev
```

### 3. Access Applications

- **Frontend**: http://localhost:3000
- **API**: http://localhost:8000
- **Admin**: http://localhost:8000/admin/
- **API Docs**: http://localhost:8000/api/docs/

### 4. Default Credentials

```
Username: admin
Password: admin123
```

⚠️ Change password immediately after first login!

## Common Development Commands

```bash
# View logs
make dev-logs
make dev-logs-django
make dev-logs-celery

# Database operations
make migrate              # Run migrations
make makemigrations      # Create migrations
make seed                # Seed initial data
make db-shell           # PostgreSQL shell
make db-backup          # Backup database

# Testing
make test               # Run all tests
make test-coverage      # Coverage report
make test APP=app_name  # Test specific app

# Code quality
make lint               # Linting checks
make format             # Auto-format code
make format:check       # Check formatting

# Management
make createsuperuser    # Create admin user
make shell              # Django shell
make shell-plus         # Django shell+IPython
```

## Production Deployment (30 minutes)

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Create deploy user
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy
```

### 2. Repository Setup

```bash
# Clone as deploy user
sudo su - deploy
git clone <repository> erp_project
cd erp_project
```

### 3. Configuration

```bash
# Generate secret key
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'

# Edit environment files
cp backend/.env.example backend/.env
# Edit with production values:
# - SECRET_KEY (from above)
# - DATABASE_PASSWORD
# - REDIS_PASSWORD
# - ALLOWED_HOSTS
# - CORS_ALLOWED_ORIGINS
# - AWS credentials (if using S3)
```

### 4. SSL Certificates

```bash
# Using Let's Encrypt (requires domain)
sudo apt install certbot
sudo certbot certonly --standalone -d example.com

# Copy certificates
sudo cp /etc/letsencrypt/live/example.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/example.com/privkey.pem nginx/ssl/key.pem
sudo chown deploy:deploy nginx/ssl/*
```

### 5. Deploy

```bash
# Build and start
make prod-build
make prod

# Run migrations
make migrate

# Seed data
make seed

# Verify
make health-check
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Nginx (Reverse Proxy)               │
│                  HTTP/HTTPS Termination                 │
└──────────────────────────┬──────────────────────────────┘
                           │
         ┌─────────────────┴──────────────────┐
         │                                    │
    ┌────▼─────┐                      ┌──────▼─────┐
    │  Next.js  │                      │  Gunicorn  │
    │ Frontend  │                      │  (Django)  │
    │ :3000     │                      │   :8000    │
    └────┬─────┘                      └──────┬─────┘
         │                                    │
         └────────────────────┬───────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
    ┌───▼────┐           ┌───▼────┐           ┌───▼────┐
    │  Redis │           │PostgreSQL          │ Celery │
    │ Cache  │           │ Database           │ Workers│
    │ :6379  │           │ :5432              │        │
    └────────┘           └────────┘           └────────┘
```

## Monitoring

### Health Checks

```bash
# Check all services
make health-check

# View running containers
make ps

# View resource usage
docker stats
```

### Logs

```bash
# Django logs
make dev-logs-django

# Celery logs
make dev-logs-celery

# All logs
make dev-logs
```

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs <service-name>

# Rebuild
docker-compose build --no-cache

# Restart
docker-compose restart
```

### Database Issues

```bash
# Connect to database
make db-shell

# Check migrations
make migrate-show

# Reset (⚠️ loses data)
docker-compose down -v
make setup
```

### Memory Issues

```bash
# Check usage
docker stats

# Reduce workers in docker-compose.prod.yml
# Restart:
docker-compose restart
```

## File Structure

```
erp_project/
├── docker-compose.yml           # Development setup
├── docker-compose.prod.yml      # Production setup
├── Makefile                     # Commands (55+)
├── DEPLOYMENT.md                # Detailed guide
├── DEVOPS_SUMMARY.md           # Complete reference
│
├── backend/                     # Django app
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   ├── api_schema.yml          # API documentation
│   ├── config/
│   │   ├── celery_schedules.py # Task scheduling
│   │   ├── redis_config.py     # Cache config
│   │   └── security.py         # Security settings
│   └── apps/                   # Feature modules
│
├── frontend/                    # Next.js app
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   └── .env.example
│
├── nginx/                       # Web server
│   ├── nginx.conf
│   └── conf.d/default.conf
│
└── scripts/                     # Utilities
    ├── init_db.sql
    └── seed_data.py
```

## Environment Variables Quick Reference

### Backend (.env)
```
DEBUG=False
SECRET_KEY=<generate-new>
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://:pass@host:6379/0
CELERY_BROKER_URL=redis://:pass@host:6379/1
CELERY_RESULT_BACKEND=redis://:pass@host:6379/2
ALLOWED_HOSTS=example.com,www.example.com
CORS_ALLOWED_ORIGINS=https://example.com
```

### Frontend (.env)
```
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_APP_NAME=Lancer ERP
```

## Deployment Checklist

- [ ] Server prepared with Docker
- [ ] Repository cloned
- [ ] Environment variables configured
- [ ] SSL certificates obtained
- [ ] Database backups configured
- [ ] Data directories created
- [ ] Services started
- [ ] Migrations run
- [ ] Health checks passing
- [ ] Firewall configured
- [ ] Monitoring configured
- [ ] Backup tested

## Support

### Documentation
- API Docs: backend/api_schema.yml
- Deployment: DEPLOYMENT.md
- Security: backend/config/security.py
- Scheduling: backend/config/celery_schedules.py

### Quick Help

```bash
# View all available commands
make help

# Check system status
make status

# Generate API schema
make docs

# Run security checks
make security-check
```

## Next Steps

1. **Customize**: Update company info, add users
2. **Configure**: Adjust email, LLM, S3 settings
3. **Deploy**: Follow DEPLOYMENT.md for production
4. **Monitor**: Setup logging and alerting
5. **Scale**: Add more workers as needed

## Stack Information

| Component | Version | Purpose |
|-----------|---------|---------|
| Django | 4.2.8 | Backend API |
| Next.js | 14.0.0 | Frontend |
| PostgreSQL | 16 | Database |
| Redis | 7 | Cache & Queue |
| Celery | 5.3.4 | Task Processing |
| Nginx | Alpine | Reverse Proxy |
| Python | 3.12 | Backend Runtime |
| Node | 20 | Frontend Runtime |

---

**Need help?** Check DEPLOYMENT.md or DEVOPS_SUMMARY.md for complete documentation.
