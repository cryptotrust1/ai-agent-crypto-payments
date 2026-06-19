# AI Agent Crypto Payments — non-custodial SDK (MCP, x402, L402)

> **Give an AI agent its own crypto wallet to send, receive and swap money — without anyone holding its funds.**
> Open-source Python & TypeScript SDKs + a full API spec for **autonomous AI agent payments**: stablecoin (USDC) payments on Base, real cross-chain swaps (BTC / USDT / XMR), pay-per-call metering (**x402** / **L402**), recurring billing, webhooks and a fiat on-ramp — all **non-custodial** and usable over the **Model Context Protocol (MCP)**.

**Keywords:** AI agent payments · agentic payments · crypto payments for AI agents · MCP payments · x402 · L402 · non-custodial agent wallet · stablecoin / USDC payments · Base · ERC-4337 session keys · 0x Gasless · autonomous agents · machine-to-machine payments · "Stripe for AI agents".

---

## Why this exists

AI agents increasingly need to **pay for things** (APIs, data, services) and
**get paid** — autonomously. Custodial money rails don't fit an autonomous agent
(accounts, sign-ups, someone holding the float). This project is the **non-custodial**
alternative: the agent holds its **own** key, payments move **directly**
wallet-to-wallet, and the service only **builds and verifies** the
transaction — it never custodies, routes or freezes funds.

It is the public client + specification for the **AceChange Agent API**. The
server is operated by AceChange; these SDKs and docs are open so any agent (or
engineer) can **read exactly how it signs requests and that the private key
never leaves the machine**, and verify the contract against the live server.

## What an AI agent can do

| Capability | What it means |
|---|---|
| 💸 **Pay anyone** | Build + broadcast a stablecoin/ETH payment to any Base wallet, within the limits you set. The agent signs it itself. |
| 📥 **Receive payments / commerce** | Register your own receive wallet, list products, take checkouts that pay **your** wallet directly ("Stripe for AI agents"). |
| 🔄 **Swap crypto** | Same-chain micro-swaps on Base (0x Gasless) **and real cross-chain** swaps to native **BTC, USDT (TRC20/ERC20), XMR**. |
| ⚡ **Pay per call** | Metered machine payments via **x402** (USDC on Base, HTTP 402) and **L402** (Bitcoin Lightning). |
| 🔁 **Subscriptions & invoicing** | Recurring plans + usage metering; an invoice is raised each cycle (payer settles — never auto-debited). |
| 🔔 **Webhooks & events** | Signed webhooks + an events feed so your backend reacts in real time. |
| 🔐 **Non-custodial wallet** | Spend caps (per-tx / daily), allow-lists, expiring session keys, instant **kill switch**. Private keys stay local. |
| 🏦 **Funding** | Top up the agent wallet directly, or via a fiat→crypto on-ramp link (a human completes the payment). |

## Connect in the way your agent already speaks

- **MCP (Model Context Protocol)** — point your MCP-capable agent at the `/mcp`
  endpoint; tools like `ace_pay`, `ace_swap_quote`, `ace_create_checkout` appear
  automatically. See [`docs/API.md`](docs/API.md#mcp-model-context-protocol).
- **Function calling** — import the ready JSON tool schema:
  [`examples/openai-functions.json`](examples/openai-functions.json).
- **SDK** — [`python/`](python/) (`pip`) or [`typescript/`](typescript/) (`npm`).
- **REST** — sign and call directly; full recipe in
  [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md).

## Quickstart

**Python**
```python
from acechange_agent_wallet import AgentWallet, Policy

w = AgentWallet(
    private_key="0x…",                     # the agent's own key, stays local
    base_url="https://www.acechange.io",
    key_id="ag_…", secret="…",             # issued by the operator
    policy=Policy(per_tx_usd=25, daily_usd=100, allowed_tokens=["USDC"]),
)
tx = w.pay("0xRecipient…", "USDC", "5", est_usd=5)   # agent signs + broadcasts
print("paid", tx)
```

**TypeScript**
```ts
import { AgentWallet } from '@acechange/agent-wallet';

const w = AgentWallet.create('./agent.keystore.json', process.env.WALLET_PASS!, {
  acechange: { baseUrl: 'https://www.acechange.io', keyId: 'ag_…', secret: '…' },
  rpcUrl: 'https://mainnet.base.org',
  policy: { perTxUsd: 25, dailyUsd: 100, allowedTokens: ['USDC'] },
});
const hash = await w.pay('0xRecipient…', 'USDC', '5', 5);
console.log('paid', hash);
```

## Verify it yourself (trust, don't assume)

Everything is checkable against the **live** server — no snapshot to trust:

- **Capability card (machine-readable):** <https://www.acechange.io/wp-json/acechange-agent/v1/agent>
- **Health:** <https://www.acechange.io/wp-json/acechange-agent/v1/health>
- **Auth signing recipe (so the SDK can't hide anything):** [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md)
- **Wallet keystore source (key never leaves the machine):** [`python/acechange_agent_wallet/keystore.py`](python/acechange_agent_wallet/keystore.py) · [`typescript/src/keystore.ts`](typescript/src/keystore.ts)

## Documentation

| Doc | Contents |
|---|---|
| [`docs/API.md`](docs/API.md) | Full API reference: endpoints, swap rails, commerce, MCP tools, events, errors. |
| [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md) | The HMAC signing recipe with copy-paste examples (curl / Python / TypeScript). |
| [`docs/WALLET-SPEC.md`](docs/WALLET-SPEC.md) | Non-custodial wallet design: session keys, caps, ERC-4337 roadmap. |

## Non-custodial — how funds actually move

```
   Agent's own wallet  ──signs──▶  blockchain  ──▶  recipient wallet
            ▲                                            
            │  builds tx · verifies · notifies
        AceChange Agent API   (never holds, routes or freezes funds)
```

The API returns an **unsigned** transaction (or a deposit address for
cross-chain). The **agent** signs and broadcasts. AceChange stores only public
addresses + your spending policy. This is what keeps it non-custodial.

## Security & honesty

- Private keys are stored in an **AES-256-GCM** encrypted keystore on the agent's
  machine — never uploaded.
- The wallet SDK is a **reference scaffold**; a fund-holding wallet **must be
  independently security-audited before mainnet use**.

## Get a key

Request an agent API key from the operator (email in the capability card). The
key carries your spend limits. Then your agent can pay, get paid, swap and
meter — non-custodially.

## License

MIT — see [`LICENSE`](LICENSE). Contributions welcome.
