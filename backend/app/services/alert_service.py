from app.services.position_service import serialize_position


def build_position_alert(
    position
) -> str | None:

    data = serialize_position(position)

    symbol = data["symbol"]
    status = data["status"]

    if status == "near_stop_loss":

        return (
            "⚠️ POSITION ALERT\n\n"
            f"{symbol}\n"
            f"{data['side']}\n\n"
            f"PNL: {data['pnl_percent']}%\n"
            f"Current: {data['current_price']}\n"
            f"Stop Loss: {data['stop_loss']}\n"
            f"SL Distance: "
            f"{data['stop_loss_distance_percent']}%\n\n"
            "Status: Near Stop Loss"
        )

    if status == "near_take_profit":

        return (
            "🎯 TARGET ALERT\n\n"
            f"{symbol}\n"
            f"{data['side']}\n\n"
            f"Current: {data['current_price']}\n"
            f"Take Profit: {data['take_profit']}\n"
            f"TP Distance: "
            f"{data['take_profit_distance_percent']}%\n\n"
            "Status: Near Take Profit"
        )

    return None
