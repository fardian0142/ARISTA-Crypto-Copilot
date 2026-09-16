from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ARISTA Crypto Copilot"
    environment: str = "development"
    secret_key: str = "change-this-secret"
    database_url: str = "sqlite+aiosqlite:///./crypto_copilot.db"

    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    monitor_interval_seconds: int = 15

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
