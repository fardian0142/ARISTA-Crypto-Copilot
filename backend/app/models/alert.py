from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True
    )

    position_id: Mapped[int | None] = mapped_column(
        ForeignKey("positions.id"),
        nullable=True
    )

    alert_type: Mapped[str] = mapped_column(
        String(40)
    )

    message: Mapped[str] = mapped_column(
        Text
    )

    threshold: Mapped[float | None] = mapped_column(
        Float,
        nullable=True
    )

    sent: Mapped[bool] = mapped_column(
        Boolean,
        default=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
