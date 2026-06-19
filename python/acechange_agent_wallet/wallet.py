"""AgentWallet (Python) — non-custodial wallet for AI agents on Base.

The agent holds its own key (encrypted keystore). High-level helpers ask the
AceChange Agent API to BUILD an intent, then sign + broadcast locally with
eth-account/web3. AceChange never holds funds.

v1 local EOA; v2 ERC-4337 smart account + session keys (see the TS smart-account
module + docs/AGENT-WALLET-SPEC.md). Audit required before mainnet.
"""
from __future__ import annotations
from eth_account import Account
from web3 import Web3

from .keystore import encrypt_private_key, decrypt_private_key, save_keystore, load_keystore
from .acechange import AceChangeAgent
from .policy import Policy
from .zerox import sign_gasless_quote

_BASE_CHAIN_ID = 8453
_DEFAULT_RPC = "https://mainnet.base.org"


class AgentWallet:
    def __init__(self, private_key: str, base_url: str, key_id: str, secret: str,
                 rpc_url: str = _DEFAULT_RPC, policy: Policy | None = None):
        self.account = Account.from_key(private_key)
        self.api = AceChangeAgent(base_url, key_id, secret)
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.policy = policy

    @classmethod
    def create(cls, keystore_path: str, passphrase: str, **kw) -> "AgentWallet":
        acct = Account.create()
        save_keystore(keystore_path, encrypt_private_key(acct.key.hex(), passphrase))
        return cls(acct.key.hex(), **kw)

    @classmethod
    def load(cls, keystore_path: str, passphrase: str, **kw) -> "AgentWallet":
        pk = decrypt_private_key(load_keystore(keystore_path), passphrase)
        return cls(pk, **kw)

    @property
    def address(self) -> str:
        return self.account.address

    def pay(self, to: str, token: str, amount: str, est_usd: float = 0, session: str | None = None) -> str:
        if self.policy:
            ok, reason = self.policy.check(token, to, est_usd)
            if not ok:
                raise RuntimeError(f"local policy: {reason}")
        built = self.api.pay(to, token, amount, from_=self.address, est_usd=est_usd, session=session)
        tx = built["tx"]
        return self._sign_and_send(tx)

    def swap(self, sell: str, buy: str, amount: str, est_usd: float = 0) -> dict:
        if self.policy:
            ok, reason = self.policy.check(sell, self.address, est_usd)
            if not ok:
                raise RuntimeError(f"local policy: {reason}")
        quote = self.api.swap_quote(sell, buy, amount, self.address)["quote"]
        signed = sign_gasless_quote(self.account, quote)  # agent signs locally
        return self.api.swap_submit(signed, est_usd=est_usd)

    def _sign_and_send(self, tx: dict) -> str:
        value = int(tx.get("value", "0x0"), 16) if isinstance(tx.get("value"), str) else int(tx.get("value", 0))
        data = tx.get("data", "0x")
        to = Web3.to_checksum_address(tx["to"])
        txn = {
            "to": to, "value": value, "data": data, "chainId": _BASE_CHAIN_ID,
            "nonce": self.w3.eth.get_transaction_count(self.address),
            "maxFeePerGas": self.w3.eth.gas_price,
            "maxPriorityFeePerGas": self.w3.to_wei(0.001, "gwei"),
        }
        txn["gas"] = self.w3.eth.estimate_gas({"to": to, "value": value, "data": data, "from": self.address})
        signed = self.account.sign_transaction(txn)
        return self.w3.eth.send_raw_transaction(signed.rawTransaction).hex()
