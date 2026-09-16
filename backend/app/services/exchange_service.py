from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ExchangePosition:
    symbol: str
    side: str
    entry_price: float
    current_price: float
    quantity: float
    take_profit: float | None = None
    stop_loss: float | None = None
    leverage: float = 1.0


class ExchangeAdapter(ABC):

    name: str

    @abstractmethod
    async def get_open_positions(
        self
    ) -> list[ExchangePosition]:
        raise NotImplementedError

    async def get_balance(self) -> float:
        return 0.0

    async def get_trade_history(self) -> list[dict]:
        return []


class DemoExchangeAdapter(ExchangeAdapter):

    name = "demo"

    async def get_open_positions(
        self
    ) -> list[ExchangePosition]:

        return [
            ExchangePosition(
                symbol="BTC/USDT",
                side="LONG",
                entry_price=104250,
                current_price=105180,
                quantity=0.12,
                take_profit=106500,
                stop_loss=102900,
                leverage=2
            ),
            ExchangePosition(
                symbol="ETH/USDT",
                side="LONG",
                entry_price=4200,
                current_price=4065,
                quantity=0.8,
                take_profit=4500,
                stop_loss=4000,
                leverage=3
            )
        ]

    async def get_balance(self) -> float:
        return 4820.0


def get_adapter(
    exchange_name: str
) -> ExchangeAdapter:

    exchange_name = exchange_name.lower()

    if exchange_name == "demo":
        return DemoExchangeAdapter()

    raise ValueError(
        f"Unsupported exchange: {exchange_name}"
    )
