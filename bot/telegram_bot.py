import asyncio
import os

import httpx


async def main():

    token = os.getenv(
        "TELEGRAM_BOT_TOKEN",
        ""
    )

    if not token:

        print(
            "TELEGRAM_BOT_TOKEN is not configured."
        )

        return

    url = (
        "https://api.telegram.org/"
        f"bot{token}/getMe"
    )

    async with httpx.AsyncClient(
        timeout=10
    ) as client:

        response = await client.get(url)

        response.raise_for_status()

        print(
            response.json()
        )


if __name__ == "__main__":
    asyncio.run(main())
