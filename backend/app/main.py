from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.db import init_db

from app.api import (
    users,
    exchanges,
    positions,
    trades,
    alerts
)


settings = get_settings()


@asynccontextmanager
async def lifespan(
    app: FastAPI
):

    await init_db()

    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "Read-only crypto position "
        "monitoring and alert platform."
    ),
    lifespan=lifespan
)


app.include_router(users.router)
app.include_router(exchanges.router)
app.include_router(positions.router)
app.include_router(trades.router)
app.include_router(alerts.router)


@app.get("/")
async def root():

    return {
        "name": settings.app_name,
        "version": "0.1.0",
        "status": "online",
        "mode": "read-only"
    }


@app.get("/health")
async def health():

    return {
        "status": "ok"
    }
