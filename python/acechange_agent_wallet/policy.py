"""Client-side spending policy (mirrors the server session policy for fast local
rejection). The server enforces again — defence in depth, not the only gate."""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date


@dataclass
class Policy:
    per_tx_usd: float = 0.0
    daily_usd: float = 0.0
    allowed_tokens: list[str] = field(default_factory=list)      # [] = any
    allowed_recipients: list[str] = field(default_factory=list)  # [] = any
    _spent: float = 0.0
    _day: str = ""

    def check(self, token: str, recipient: str, est_usd: float) -> tuple[bool, str]:
        if self.allowed_tokens and token.upper() not in [t.upper() for t in self.allowed_tokens]:
            return False, "token not allowed"
        if self.allowed_recipients and recipient.lower() not in [r.lower() for r in self.allowed_recipients]:
            return False, "recipient not allowed"
        if self.per_tx_usd and est_usd > self.per_tx_usd:
            return False, "over per-tx cap"
        if self.daily_usd:
            today = date.today().isoformat()
            if today != self._day:
                self._day, self._spent = today, 0.0
            if self._spent + est_usd > self.daily_usd:
                return False, "over daily cap"
            self._spent += est_usd
        return True, ""
