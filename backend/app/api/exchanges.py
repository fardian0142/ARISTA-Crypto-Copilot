from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.exchange import ExchangeAccount


router = APIRouter(
    prefix="/api/exchanges",
    tags=["exchanges"]
)


class ExchangeCreate(BaseModel):

    user_id: int
    exchange_name: str
    label: str = ""


@router.post("")
async def create_exchange(
    payload: ExchangeCreate,
    db: AsyncSession = Depends(get_db)
):

    account = ExchangeAccount(
        user_id=payload.user_id,
        exchange_name=payload.exchange_name.lower(),
        label=payload.label,
        read_only=True
    )

    db.add(account)

    await db.commit()

    await db.refresh(account)

    return {
        "id": account.id,
        "user_id": account.user_id,
        "exchange_name": account.exchange_name,
        "read_only": account.read_only,
        "enabled": account.enabled
    }


@router.get("/{user_id}")
async def list_exchanges(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):

    result = await db.execute(
        select(ExchangeAccount)
        .where(
            ExchangeAccount.user_id == user_id
        )
        .order_by(ExchangeAccount.id)
    )

    accounts = result.scalars().all()

    return [
        {
            "id": account.id,
            "exchange_name": account.exchange_name,
            "label": account.label,
            "read_only": account.read_only,
            "enabled": account.enabled
        }
        for account in accounts
    ]
