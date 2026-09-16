# ARISTA Crypto Copilot

Read-only crypto position monitoring platform.

## MVP

- User management
- Exchange accounts
- Read-only architecture
- Open position monitoring
- PnL calculation
- TP/SL distance
- Position status
- Alert engine
- Telegram integration
- REST API
- SQLite development database

## Security

The MVP does not place orders.

No trading permission is required.

No withdrawal permission is required.

No transfer permission is required.

## Run locally

Create environment:

    python -m venv .venv

Activate:

    Linux/macOS:
    source .venv/bin/activate

    Windows:
    .venv\Scripts\activate

Install:

    pip install -r backend/requirements.txt

Copy:

    cp .env.example .env

Run:

    uvicorn app.main:app --reload --app-dir backend

API:

    http://127.0.0.1:8000

Documentation:

    http://127.0.0.1:8000/docs

Health:

    http://127.0.0.1:8000/health

Demo positions:

    http://127.0.0.1:8000/api/positions/demo

Demo alerts:

    http://127.0.0.1:8000/api/alerts/demo
