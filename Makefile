.PHONY: help setup dev prod logs test lint format migrate seed clean build deploy stop restart

# Variables
DOCKER_COMPOSE_DEV = docker-compose -f docker-compose.yml
DOCKER_COMPOSE_PROD = docker-compose -f docker-compose.prod.yml -f docker-compose.override.yml
PYTHON = docker-compose exec django python
MANAGE_PY = manage.py
DOCKER_BUILD_ARGS = --no-cache

# Color output
BLUE = \033[0;34m
GREEN = \033[0;32m
YELLOW = \033[0;33m
RED = \033[0;31m
NC = \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)Lancer ERP - Available Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

# ===== Development =====

setup: ## Setup development environment (install deps, migrate, seed)
	@echo "$(BLUE)Setting up development environment...$(NC)"
	$(DOCKER_COMPOSE_DEV) build
	$(DOCKER_COMPOSE_DEV) up -d
	@sleep 10
	$(MAKE) migrate
	$(MAKE) seed
	@echo "$(GREEN)✓ Development environment ready!$(NC)"

dev: ## Start development environment
	@echo "$(BLUE)Starting development environment...$(NC)"
	$(DOCKER_COMPOSE_DEV) up

dev-build: ## Build development images
	@echo "$(BLUE)Building development images...$(NC)"
	$(DOCKER_COMPOSE_DEV) build $(DOCKER_BUILD_ARGS)

dev-down: ## Stop development environment
	@echo "$(BLUE)Stopping development environment...$(NC)"
	$(DOCKER_COMPOSE_DEV) down

dev-logs: ## Show development logs
	$(DOCKER_COMPOSE_DEV) logs -f

dev-logs-django: ## Show Django logs only
	$(DOCKER_COMPOSE_DEV) logs -f django

dev-logs-celery: ## Show Celery logs only
	$(DOCKER_COMPOSE_DEV) logs -f celery_worker

dev-logs-frontend: ## Show Frontend logs only
	$(DOCKER_COMPOSE_DEV) logs -f frontend

# ===== Production =====

prod: ## Start production environment
	@echo "$(BLUE)Starting production environment...$(NC)"
	$(DOCKER_COMPOSE_PROD) up -d
	@echo "$(GREEN)✓ Production environment started$(NC)"

prod-build: ## Build production images
	@echo "$(BLUE)Building production images...$(NC)"
	$(DOCKER_COMPOSE_PROD) build $(DOCKER_BUILD_ARGS)

prod-down: ## Stop production environment
	@echo "$(BLUE)Stopping production environment...$(NC)"
	$(DOCKER_COMPOSE_PROD) down

prod-logs: ## Show production logs
	$(DOCKER_COMPOSE_PROD) logs -f

prod-restart: ## Restart production services
	@echo "$(BLUE)Restarting production services...$(NC)"
	$(DOCKER_COMPOSE_PROD) restart
	@echo "$(GREEN)✓ Services restarted$(NC)"

# ===== Database =====

migrate: ## Run Django migrations
	@echo "$(BLUE)Running database migrations...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec -T django python manage.py migrate

migrate-make: ## Create migrations for changes
	@echo "$(BLUE)Creating migrations...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec django python manage.py makemigrations

migrate-show: ## Show unapplied migrations
	@echo "$(BLUE)Showing migration status...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec django python manage.py showmigrations

seed: ## Seed database with initial data
	@echo "$(BLUE)Seeding database...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec -T django python manage.py seed_data

seed-full: ## Seed database with full sample data
	@echo "$(BLUE)Seeding database with sample data...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec -T django python manage.py seed_data --full

db-backup: ## Backup PostgreSQL database
	@echo "$(BLUE)Backing up database...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec -T db pg_dump -U erp_user -d erp_db > backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Backup created$(NC)"

db-restore: ## Restore PostgreSQL database (requires DB_BACKUP_FILE)
	@echo "$(BLUE)Restoring database from $(DB_BACKUP_FILE)...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec -T db psql -U erp_user -d erp_db < $(DB_BACKUP_FILE)
	@echo "$(GREEN)✓ Database restored$(NC)"

db-shell: ## Open Django database shell
	$(DOCKER_COMPOSE_DEV) exec django python manage.py dbshell

db-psql: ## Open PostgreSQL shell
	$(DOCKER_COMPOSE_DEV) exec db psql -U erp_user -d erp_db

# ===== Testing =====

test: ## Run all tests
	@echo "$(BLUE)Running tests...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec -T django python manage.py test

test-coverage: ## Run tests with coverage report
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec -T django coverage run --source='.' manage.py test
	$(DOCKER_COMPOSE_DEV) exec -T django coverage report

test-fast: ## Run fast tests (no migrations)
	@echo "$(BLUE)Running fast tests...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec -T django python manage.py test --keepdb

test-app: ## Run tests for specific app (requires APP_NAME)
	@echo "$(BLUE)Running tests for $(APP_NAME)...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec -T django python manage.py test $(APP_NAME)

# ===== Code Quality =====

lint: ## Run linting checks
	@echo "$(BLUE)Running linting...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec -T django flake8 --max-line-length=120 --exclude=.git,__pycache__,migrations
	$(DOCKER_COMPOSE_DEV) exec -T django pylint --load-plugins pylint_django */models.py
	@echo "$(GREEN)✓ Linting complete$(NC)"

format: ## Auto-format code (Black + isort)
	@echo "$(BLUE)Formatting code...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec -T django black --line-length=120 .
	$(DOCKER_COMPOSE_DEV) exec -T django isort --profile black .
	@echo "$(GREEN)✓ Code formatted$(NC)"

security-check: ## Run security checks
	@echo "$(BLUE)Running security checks...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec -T django python manage.py check --deploy
	@echo "$(GREEN)✓ Security checks complete$(NC)"

requirements-update: ## Update pip requirements
	@echo "$(BLUE)Updating requirements...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec django pip list --outdated

# ===== Static Files =====

collectstatic: ## Collect static files
	@echo "$(BLUE)Collecting static files...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec -T django python manage.py collectstatic --noinput

clearcache: ## Clear cache
	@echo "$(BLUE)Clearing cache...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec -T django python manage.py clearcache
	@echo "$(GREEN)✓ Cache cleared$(NC)"

# ===== Celery =====

celery-purge: ## Purge all Celery tasks
	@echo "$(BLUE)Purging Celery tasks...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec redis redis-cli -n 1 FLUSHDB
	@echo "$(GREEN)✓ Tasks purged$(NC)"

celery-inspect: ## Inspect active Celery workers
	$(DOCKER_COMPOSE_DEV) exec django celery -A config inspect active

celery-stats: ## Show Celery worker statistics
	$(DOCKER_COMPOSE_DEV) exec django celery -A config inspect stats

# ===== Admin & Management =====

createsuperuser: ## Create Django superuser
	@echo "$(BLUE)Creating superuser...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec django python manage.py createsuperuser

shell: ## Open Django shell
	$(DOCKER_COMPOSE_DEV) exec django python manage.py shell

shell-plus: ## Open Django shell_plus (IPython)
	$(DOCKER_COMPOSE_DEV) exec django python manage.py shell_plus

# ===== Container Management =====

ps: ## Show running containers
	docker-compose ps

stop: ## Stop all containers
	@echo "$(BLUE)Stopping all containers...$(NC)"
	$(DOCKER_COMPOSE_DEV) stop

restart: ## Restart all containers
	@echo "$(BLUE)Restarting all containers...$(NC)"
	$(DOCKER_COMPOSE_DEV) restart

remove: ## Remove all containers (WARNING: Deletes data)
	@echo "$(RED)⚠️  This will delete all containers and data!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] && $(DOCKER_COMPOSE_DEV) down -v || echo "Cancelled"

clean: ## Clean up unused images, volumes, and containers
	@echo "$(BLUE)Cleaning up Docker resources...$(NC)"
	docker system prune -f
	@echo "$(GREEN)✓ Cleanup complete$(NC)"

# ===== Build & Deploy =====

build: ## Build all Docker images
	@echo "$(BLUE)Building Docker images...$(NC)"
	docker build -t erp-backend:latest ./backend
	docker build -t erp-frontend:latest ./frontend
	@echo "$(GREEN)✓ Build complete$(NC)"

deploy: ## Deploy to production
	@echo "$(BLUE)Deploying to production...$(NC)"
	@echo "$(YELLOW)⚠️  Make sure to configure production environment variables first!$(NC)"
	$(MAKE) prod-build
	$(MAKE) prod
	$(MAKE) migrate
	@echo "$(GREEN)✓ Deployment complete$(NC)"

# ===== Documentation =====

docs: ## Generate API documentation
	@echo "$(BLUE)Generating API documentation...$(NC)"
	$(DOCKER_COMPOSE_DEV) exec -T django python manage.py spectacular --file schema.yml
	@echo "$(GREEN)✓ Documentation generated: schema.yml$(NC)"

# ===== Monitoring & Debugging =====

status: ## Show system status
	@echo "$(BLUE)System Status$(NC)"
	@echo "Containers:"
	@docker-compose ps
	@echo ""
	@echo "Docker Disk Usage:"
	@docker system df

health-check: ## Run health checks on all services
	@echo "$(BLUE)Running health checks...$(NC)"
	@curl -s http://localhost:8000/health/ && echo "Django: ✓" || echo "Django: ✗"
	@curl -s http://localhost:3000/ > /dev/null && echo "Frontend: ✓" || echo "Frontend: ✗"
	@redis-cli -p 6379 ping && echo "Redis: ✓" || echo "Redis: ✗"
	@pg_isready -h localhost -p 5432 && echo "PostgreSQL: ✓" || echo "PostgreSQL: ✗"

# ===== Environment =====

env-create: ## Create .env files from examples
	@echo "$(BLUE)Creating environment files...$(NC)"
	@test -f backend/.env || (cp backend/.env.example backend/.env && echo "Created backend/.env")
	@test -f frontend/.env || (cp frontend/.env.example frontend/.env && echo "Created frontend/.env")
	@test -f .env || (cp .env.example .env && echo "Created .env")
	@echo "$(GREEN)✓ Environment files created$(NC)"

env-validate: ## Validate environment configuration
	@echo "$(BLUE)Validating environment...$(NC)"
	@test -f backend/.env && echo "backend/.env: ✓" || echo "backend/.env: ✗"
	@test -f frontend/.env && echo "frontend/.env: ✓" || echo "frontend/.env: ✗"
	@echo "$(GREEN)✓ Validation complete$(NC)"

.DEFAULT_GOAL := help
