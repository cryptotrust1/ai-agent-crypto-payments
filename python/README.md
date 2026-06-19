# acechange-agent-wallet (Python)

**Non-custodial, policy-scoped crypto wallet for AI agents** — Python port of
[`@acechange/agent-wallet`](../agent-wallet). Keys live with the bot; AceChange
never custodies. Built for **Base** + the [AceChange Agent API](../docs/AGENT-API.md).

> ⚠️ Open-source reference (v0.1). v1 = local EOA; v2 = ERC-4337 smart account +
> on-chain session keys. **Independent security audit required before mainnet.**

## Install
```bash
pip install acechange-agent-wallet
```

## Quickstart
```python
import os
from acechange_agent_wallet import AgentWallet, Policy

w = AgentWallet.create(
    "agent.keystore.json", os.environ["WALLET_PASS"],
    base_url="https://www.acechange.io", key_id="ag_…", secret="…",
    rpc_url="https://mainnet.base.org",
    policy=Policy(per_tx_usd=25, daily_usd=100, allowed_tokens=["USDC"]),
)
print("agent address", w.address)

# register a scoped session key + policy (public address only)
w.api.wallet_register(w.address)
w.api.wallet_session(w.address, per_tx_usd=25, daily_usd=100,
                     allowed_tokens="USDC", allowed_recipients="0xRecipient…",
                     expires_in=86400)

# pay anyone (non-custodial): AceChange builds + screens; we sign & broadcast
tx_hash = w.pay("0xRecipient…", "USDC", "5", est_usd=5, session=w.address)
print("paid", tx_hash)
```

## Security
1. Keys in an AES-256-GCM encrypted keystore (cross-compatible with the TS SDK).
2. AceChange stores only public addresses + policy — it cannot move funds.
3. Uses `eth-account` / `web3` (standard) — no custom crypto.
4. Audit before holding real funds.

MIT licensed.
