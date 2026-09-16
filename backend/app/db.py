from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    future=True
)

SessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    from app.models.user import User
    from app.models.exchange import ExchangeAccount
    from app.models.position import Position
    from app.models.trade import Trade
    from app.models.alert import Alert

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
