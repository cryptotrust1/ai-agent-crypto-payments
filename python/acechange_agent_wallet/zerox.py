"""0x Gasless v2 EIP-712 signing (mirrors the TS SDK zerox.ts).

Signs the `trade` (+ `approval` when present) the /gasless/quote returns, using
eth-account, and assembles the /gasless/submit payload. Non-custodial.
Verify field shapes once against a live 0x key.
"""
from __future__ import annotations
from eth_account import Account
from eth_account.messages import encode_typed_data


def _sign_712(account, e: dict) -> str:
    types = dict(e.get("types", {}))
    types.pop("EIP712Domain", None)  # eth-account derives the domain type
    signable = encode_typed_data(full_message={
        "domain": e["domain"],
        "types": types,
        "primaryType": e["primaryType"],
        "message": e["message"],
    })
    return account.sign_message(signable).signature.hex()


def sign_gasless_quote(account, quote: dict) -> dict:
    out: dict = {"chainId": quote.get("chainId", 8453)}
    approval = quote.get("approval")
    if approval and approval.get("eip712"):
        out["approval"] = {"type": approval.get("type"), "eip712": approval["eip712"],
                           "signature": _sign_712(account, approval["eip712"])}
    trade = quote.get("trade")
    if not (trade and trade.get("eip712")):
        raise ValueError("0x quote has no trade.eip712 to sign")
    out["trade"] = {"type": trade.get("type"), "eip712": trade["eip712"],
                    "signature": _sign_712(account, trade["eip712"])}
    return out
