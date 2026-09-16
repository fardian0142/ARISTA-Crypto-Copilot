from fastapi import APIRouter, HTTPException

from app.services.exchange_service import get_adapter
from app.services.position_service import serialize_position


router = APIRouter(
    prefix="/api/positions",
    tags=["positions"]
)


@router.get("/demo")
async def demo_positions():

    adapter = get_adapter("demo")

    positions = (
        await adapter.get_open_positions()
    )

    return {
        "exchange": adapter.name,
        "positions": [
            serialize_position(position)
            for position in positions
        ]
    }


@router.get("/{exchange_name}")
async def exchange_positions(
    exchange_name: str
):

    try:
        adapter = get_adapter(
            exchange_name
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc

    positions = (
        await adapter.get_open_positions()
    )

    return {
        "exchange": adapter.name,
        "positions": [
            serialize_position(position)
            for position in positions
        ]
    }
