#!/usr/bin/env bash
# ==============================================================================
# Mifrufely Web — Development Scripts
# Usage: ./scripts/dev.sh [command]
# ==============================================================================

set -euo pipefail

VENV=".venv"
PYTHON="${VENV}/bin/python"
PIP="${VENV}/bin/pip"

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }


# ── Commands ──────────────────────────────────────────────────────────────────

cmd_install() {
    info "Creating virtual environment..."
    python3.11 -m venv "${VENV}"
    info "Installing production dependencies..."
    ${PIP} install --upgrade pip wheel
    ${PIP} install -r requirements.txt
    info "Installing dev dependencies..."
    ${PIP} install -r requirements-dev.txt
    info "Done! Activate with: source .venv/bin/activate"
}

cmd_dev() {
    info "Starting FastAPI development server..."
    ${PYTHON} -m uvicorn app.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --reload \
        --log-level info
}

cmd_lint() {
    info "Running Ruff..."
    ${VENV}/bin/ruff check app/ tests/
    info "Running Black check..."
    ${VENV}/bin/black --check app/ tests/
    info "Running MyPy..."
    ${VENV}/bin/mypy app/
}

cmd_format() {
    info "Formatting with Ruff..."
    ${VENV}/bin/ruff check --fix app/ tests/
    info "Formatting with Black..."
    ${VENV}/bin/black app/ tests/
}

cmd_test() {
    info "Running tests..."
    ${VENV}/bin/pytest tests/ \
        --cov=app \
        --cov-report=term-missing \
        --cov-report=html \
        -v "$@"
}

cmd_test_unit() {
    cmd_test -m unit "$@"
}

cmd_test_e2e() {
    cmd_test -m e2e "$@"
}

cmd_worker() {
    info "Starting Celery worker..."
    ${VENV}/bin/celery -A app.infrastructure.workers.celery_app worker \
        --loglevel=info \
        --concurrency=2
}

cmd_beat() {
    info "Starting Celery beat..."
    ${VENV}/bin/celery -A app.infrastructure.workers.celery_app beat \
        --loglevel=info
}

cmd_docker_up() {
    info "Starting Docker services..."
    docker compose up --build -d
    info "Services started. API: http://localhost:8000/api/docs"
}

cmd_docker_down() {
    info "Stopping Docker services..."
    docker compose down
}


# ── Dispatch ──────────────────────────────────────────────────────────────────

case "${1:-help}" in
    install)    cmd_install ;;
    dev)        cmd_dev ;;
    lint)       cmd_lint ;;
    format)     cmd_format ;;
    test)       shift; cmd_test "$@" ;;
    test:unit)  shift; cmd_test_unit "$@" ;;
    test:e2e)   shift; cmd_test_e2e "$@" ;;
    worker)     cmd_worker ;;
    beat)       cmd_beat ;;
    docker:up)  cmd_docker_up ;;
    docker:down) cmd_docker_down ;;
    help|*)
        echo ""
        echo "Mifrufely Web Backend — Dev Scripts"
        echo ""
        echo "Usage: ./scripts/dev.sh <command>"
        echo ""
        echo "Commands:"
        echo "  install      — Create venv and install all dependencies"
        echo "  dev          — Start FastAPI hot-reload server"
        echo "  lint         — Run Ruff + Black + MyPy"
        echo "  format       — Auto-format with Ruff + Black"
        echo "  test         — Run all tests with coverage"
        echo "  test:unit    — Run unit tests only"
        echo "  test:e2e     — Run e2e tests only"
        echo "  worker       — Start Celery worker"
        echo "  beat         — Start Celery beat scheduler"
        echo "  docker:up    — Build and start all Docker services"
        echo "  docker:down  — Stop all Docker services"
        echo ""
        ;;
esac
