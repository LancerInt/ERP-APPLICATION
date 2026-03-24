# Lancer ERP - Deployment Guide

## Overview

This guide covers the setup and deployment of the Lancer ERP system using Docker, Docker Compose, and related DevOps tools.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Linux server (Ubuntu 20.04+ recommended)
- 8GB RAM minimum (16GB recommended)
- 100GB disk space minimum
- Domain name and SSL certificate (production)

## Development Setup

### Quick Start

1. Clone the repository:
```bash
git clone <repository-url>
cd erp_project
```

2. Create environment files:
```bash
make env-create
```

3. Setup development environment:
```bash
make setup
```

4. Start development server:
```bash
make dev
```

5. Access the application:
- Frontend: http://localhost:3000
- API: http://localhost:8000
- Admin: http://localhost:8000/admin/

### Common Development Commands

```bash
# View logs
make dev-logs

# Run migrations
make migrate

# Seed database
make seed

# Run tests
make test

# Code formatting
make format
make lint

# Shell access
make shell
make db-shell
```

## Production Deployment

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create deployment user
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy
```

### 2. Prepare Configuration

```bash
# Switch to deploy user
sudo su - deploy

# Create data directories
mkdir -p /data/erp/{postgres,redis,static,media,logs}

# Clone repository
git clone <repository-url> erp_project
cd erp_project

# Create environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp .env.example .env
```

### 3. Configure Environment Variables

Edit `.env` and backend/.env:

```bash
# Required variables for production
DEBUG=False
ENVIRONMENT=production
SECRET_KEY=<generate-secure-key>
DATABASE_PASSWORD=<secure-password>
REDIS_PASSWORD=<secure-password>
ALLOWED_HOSTS=example.com,www.example.com
CORS_ALLOWED_ORIGINS=https://example.com
FRONTEND_API_URL=https://api.example.com
```

Generate SECRET_KEY:
```bash
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

### 4. Setup SSL Certificates

Using Let's Encrypt and Certbot:

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d example.com -d www.example.com

# Copy certificates
sudo cp /etc/letsencrypt/live/example.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/example.com/privkey.pem nginx/ssl/key.pem
sudo chown deploy:deploy nginx/ssl/*
```

### 5. Build and Deploy

```bash
# Build images
make build

# Create data directories
mkdir -p /data/erp/{postgres,redis,static,media}

# Start production environment
make prod

# Run migrations
make migrate

# Seed initial data
make seed
```

### 6. Verify Deployment

```bash
# Check service health
docker-compose ps

# View logs
make prod-logs

# Health check
curl https://example.com/health/
curl https://example.com/api/health/
```

## Backup and Recovery

### Database Backup

```bash
# Backup database
make db-backup

# With custom filename
docker-compose exec db pg_dump -U erp_user -d erp_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Upload to S3
aws s3 cp backup.sql s3://your-backup-bucket/
```

### Database Restore

```bash
# Restore from local backup
make db-restore DB_BACKUP_FILE=backup.sql

# Restore from S3
aws s3 cp s3://your-backup-bucket/backup.sql .
make db-restore DB_BACKUP_FILE=backup.sql
```

### Automated Backups

Set up cron job:

```bash
crontab -e
```

Add:
```cron
# Daily backup at 2 AM
0 2 * * * cd /home/deploy/erp_project && docker-compose exec -T db pg_dump -U erp_user -d erp_db | gzip > /data/erp/backups/backup_$(date +\%Y\%m\%d_\%H\%M\%S).sql.gz
```

## Monitoring and Maintenance

### Health Checks

```bash
# System health
make health-check

# View statistics
make status

# Monitor in real-time
watch -n 5 docker stats
```

### Log Management

```bash
# View logs
make prod-logs

# Filter logs
docker-compose logs -f django | grep ERROR

# Export logs
docker-compose logs --no-color > logs.txt
```

### Performance Optimization

1. **Database Optimization**:
```bash
# Vacuum database
make db-vacuum

# Analyze tables
docker-compose exec db psql -U erp_user -d erp_db -c "ANALYZE;"
```

2. **Cache Management**:
```bash
# Clear cache
make clearcache

# Monitor cache
docker-compose exec redis redis-cli INFO
```

3. **Worker Scaling**:
Edit docker-compose.prod.yml to increase worker concurrency or add more workers.

## Security Hardening

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw enable
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
```

### SSL/TLS Configuration

- Use TLS 1.2+ only
- Implement HSTS with preload
- Setup Certificate Pinning (optional)
- Regular certificate renewal

### Access Control

- Restrict Docker daemon access
- Use secrets for sensitive data
- Enable audit logging
- Implement IP whitelisting (if applicable)

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs <service-name>

# Validate configuration
docker-compose config

# Try rebuilding
docker-compose build --no-cache <service-name>
```

### Database Connection Issues

```bash
# Test database connection
docker-compose exec django python manage.py dbshell

# Check database logs
docker-compose logs db
```

### Memory Issues

```bash
# Check resource usage
docker stats

# Increase container limits
# Edit docker-compose.prod.yml and adjust memory limits
```

### Celery Task Issues

```bash
# Inspect active tasks
make celery-inspect

# View worker stats
make celery-stats

# Purge stuck tasks
make celery-purge
```

## Updates and Upgrades

### Zero-Downtime Deployment

```bash
# 1. Build new images
docker-compose -f docker-compose.prod.yml build

# 2. Pull code changes
git pull origin main

# 3. Run migrations
docker-compose -f docker-compose.prod.yml exec django python manage.py migrate

# 4. Collect static files
docker-compose -f docker-compose.prod.yml exec django python manage.py collectstatic --noinput

# 5. Restart services (one by one for zero downtime)
docker-compose -f docker-compose.prod.yml restart django
docker-compose -f docker-compose.prod.yml restart celery_worker
```

## Monitoring Stack (Optional)

### Setup Prometheus + Grafana

1. Add monitoring services to docker-compose
2. Configure metric scraping
3. Create dashboards
4. Setup alerting

## Support and Contact

For issues and support:
- Email: support@lancererp.example.com
- Documentation: https://docs.lancererp.example.com
- Issue Tracker: https://github.com/lancererp/issues

## License

Proprietary - All rights reserved
