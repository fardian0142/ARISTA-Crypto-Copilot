from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.user import User


router = APIRouter(
    prefix="/api/users",
    tags=["users"]
)


class UserCreate(BaseModel):

    name: str = Field(
        min_length=1,
        max_length=120
    )

    telegram_chat_id: str = ""


@router.post("")
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db)
):

    user = User(
        name=payload.name,
        telegram_chat_id=payload.telegram_chat_id
    )

    db.add(user)

    await db.commit()

    await db.refresh(user)

    return {
        "id": user.id,
        "name": user.name,
        "telegram_chat_id": user.telegram_chat_id
    }


@router.get("")
async def list_users(
    db: AsyncSession = Depends(get_db)
):

    result = await db.execute(
        select(User).order_by(User.id)
    )

    users = result.scalars().all()

    return [
        {
            "id": user.id,
            "name": user.name,
            "telegram_chat_id": user.telegram_chat_id
        }
        for user in users
    ]
