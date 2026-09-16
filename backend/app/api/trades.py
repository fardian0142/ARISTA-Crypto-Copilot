from fastapi import APIRouter


router = APIRouter(
    prefix="/api/trades",
    tags=["trades"]
)


@router.get("/demo")
async def demo_trades():

    return {
        "trades": [],
        "message": (
            "Trade history endpoint is ready. "
            "Exchange synchronization will populate it."
        )
    }
