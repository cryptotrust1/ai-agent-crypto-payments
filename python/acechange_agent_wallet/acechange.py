"""Signed client for the AceChange Agent API (acechange-agent/v1).

Auth: HMAC-SHA256 over "METHOD\\nROUTE\\nTS\\nBODY" keyed by sha256(secret),
matching FFE_Agent_Keys::authenticate() on the server (and the TS SDK).
"""
from __future__ import annotations
import hashlib
import hmac
import json
import time
import requests

_NS = "/wp-json/acechange-agent/v1"


class AceChangeAgent:
    def __init__(self, base_url: str, key_id: str, secret: str):
        self.base_url = base_url.rstrip("/")
        self.key_id = key_id
        self.secret = secret

    def _sign(self, method: str, route: str, ts: int, body: str) -> str:
        key = hashlib.sha256(self.secret.encode("utf-8")).hexdigest()
        msg = f"{method}\n{route}\n{ts}\n{body}".encode("utf-8")
        return hmac.new(key.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    def _call(self, method: str, path: str, json_body: dict | None = None) -> dict:
        route = f"{_NS}{path}"
        ts = int(time.time())
        body = json.dumps(json_body, separators=(",", ":")) if json_body is not None else ""
        headers = {
            "Content-Type": "application/json",
            "X-Ace-Agent-Key": self.key_id,
            "X-Ace-Agent-Timestamp": str(ts),
            "X-Ace-Agent-Sign": self._sign(method, route, ts, body),
        }
        resp = requests.request(method, f"{self.base_url}{route}", headers=headers,
                                data=body or None, timeout=20)
        try:
            data = resp.json()
        except ValueError:
            data = {}
        if not resp.ok:
            raise RuntimeError(f"AceChange {path} -> {resp.status_code}: {data}")
        return data

    # swaps (non-custodial; you sign the returned payload)
    def swap_quote(self, sell, buy, amount, taker):
        return self._call("POST", "/swap/quote", {"sell": sell, "buy": buy, "amount": amount, "taker": taker})

    def swap_submit(self, signed, est_usd=0):
        return self._call("POST", "/swap/submit", {"signed": signed, "est_usd": est_usd})

    # pay anyone (non-custodial; returns a tx for you to sign)
    def pay(self, to, token, amount, from_=None, est_usd=0, session=None):
        body = {"to": to, "token": token, "amount": amount, "est_usd": est_usd}
        if from_:
            body["from"] = from_
        if session:
            body["session"] = session
        return self._call("POST", "/pay", body)

    # wallet registry (public addresses + policy only)
    def wallet_register(self, owner_address, label=""):
        return self._call("POST", "/wallet/register", {"owner_address": owner_address, "label": label})

    def wallet_smart_account(self, smart_account, owner_address, label=""):
        return self._call("POST", "/wallet/smart-account",
                          {"smart_account": smart_account, "owner_address": owner_address, "label": label})

    def wallet_session(self, session_address, per_tx_usd=0, daily_usd=0,
                       allowed_tokens="any", allowed_recipients="any", expires_in=0, **extra):
        body = {"session_address": session_address, "per_tx_usd": per_tx_usd, "daily_usd": daily_usd,
                "allowed_tokens": allowed_tokens, "allowed_recipients": allowed_recipients, "expires_in": expires_in}
        body.update(extra)
        return self._call("POST", "/wallet/session", body)

    def wallet_revoke(self, session_address):
        return self._call("POST", "/wallet/revoke", {"session_address": session_address})

    def provision(self):
        return self._call("GET", "/wallet/provision")
