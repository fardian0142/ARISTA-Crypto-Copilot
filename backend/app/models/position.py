from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True
    )

    exchange_account_id: Mapped[int] = mapped_column(
        ForeignKey("exchange_accounts.id"),
        index=True
    )

    symbol: Mapped[str] = mapped_column(
        String(40),
        index=True
    )

    side: Mapped[str] = mapped_column(
        String(10)
    )

    entry_price: Mapped[float] = mapped_column(
        Float
    )

    current_price: Mapped[float] = mapped_column(
        Float
    )

    quantity: Mapped[float] = mapped_column(
        Float
    )

    take_profit: Mapped[float | None] = mapped_column(
        Float,
        nullable=True
    )

    stop_loss: Mapped[float | None] = mapped_column(
        Float,
        nullable=True
    )

    leverage: Mapped[float] = mapped_column(
        Float,
        default=1
    )

    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
