from fastapi import APIRouter

from app.services.alert_service import (
    build_position_alert
)
from app.services.exchange_service import (
    get_adapter
)


router = APIRouter(
    prefix="/api/alerts",
    tags=["alerts"]
)


@router.get("/demo")
async def demo_alerts():

    adapter = get_adapter("demo")

    alerts = []

    positions = (
        await adapter.get_open_positions()
    )

    for position in positions:

        message = build_position_alert(
            position
        )

        if message:

            alerts.append(
                {
                    "symbol": position.symbol,
                    "message": message
                }
            )

    return {
        "alerts": alerts
    }
