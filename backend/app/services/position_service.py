from dataclasses import asdict

from app.services.exchange_service import ExchangePosition


def calculate_pnl(
    position: ExchangePosition
) -> tuple[float, float]:

    direction = (
        1
        if position.side.upper() == "LONG"
        else -1
    )

    pnl = (
        (position.current_price - position.entry_price)
        * position.quantity
        * direction
    )

    notional = (
        position.entry_price
        * position.quantity
    )

    pnl_percent = (
        pnl / notional * 100
        if notional
        else 0
    )

    return pnl, pnl_percent


def distance_to_level(
    current_price: float,
    level: float | None
) -> float | None:

    if level is None or current_price == 0:
        return None

    return (
        abs(level - current_price)
        / current_price
        * 100
    )


def position_status(
    position: ExchangePosition
) -> str:

    sl_distance = distance_to_level(
        position.current_price,
        position.stop_loss
    )

    tp_distance = distance_to_level(
        position.current_price,
        position.take_profit
    )

    if (
        sl_distance is not None
        and sl_distance <= 1
    ):
        return "near_stop_loss"

    if (
        tp_distance is not None
        and tp_distance <= 1
    ):
        return "near_take_profit"

    return "healthy"


def serialize_position(
    position: ExchangePosition
) -> dict:

    pnl, pnl_percent = calculate_pnl(position)

    sl_distance = distance_to_level(
        position.current_price,
        position.stop_loss
    )

    tp_distance = distance_to_level(
        position.current_price,
        position.take_profit
    )

    return {
        **asdict(position),
        "pnl": round(pnl, 8),
        "pnl_percent": round(pnl_percent, 4),
        "stop_loss_distance_percent": (
            round(sl_distance, 4)
            if sl_distance is not None
            else None
        ),
        "take_profit_distance_percent": (
            round(tp_distance, 4)
            if tp_distance is not None
            else None
        ),
        "status": position_status(position)
    }
