import httpx

from app.config import get_settings


async def send_telegram_message(
    text: str,
    chat_id: str | None = None
) -> bool:

    settings = get_settings()

    target_chat_id = (
        chat_id
        or settings.telegram_chat_id
    )

    if (
        not settings.telegram_bot_token
        or not target_chat_id
    ):
        return False

    url = (
        "https://api.telegram.org/"
        f"bot{settings.telegram_bot_token}/sendMessage"
    )

    async with httpx.AsyncClient(
        timeout=10
    ) as client:

        response = await client.post(
            url,
            json={
                "chat_id": target_chat_id,
                "text": text
            }
        )

        response.raise_for_status()

    return True
