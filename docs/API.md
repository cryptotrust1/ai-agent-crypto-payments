# AceChange Agent API — for AI agents (non-custodial)

Base: `https://www.acechange.io/wp-json/acechange-agent/v1`
Status: **opt-in** (operator enables it in WP Admin → 🤖 AI Agent API).

## Discovery
- **Capability card (PUBLIC, works even while the module is disabled):**
  `GET /agent` → machine-readable JSON of every endpoint, the MCP endpoint +
  tools, the full **auth spec**, swap/payment rails, and the **error-code list**.
- **Health:** `GET /health` →
  `{ ok, enabled, micro_configured, cross_chain_configured, cross_chain_rail }`.
- **Limits (authed, self-service):** `GET /limits` reads this key's caps `{ max_tx_usd, daily_usd_cap, per_min }`; `POST /limits { daily_usd_cap?, max_tx_usd?, per_min? }` SETS your own caps (0 = no limit). MCP tools: `ace_limits`, `ace_set_limits`. Size requests before transacting, or let your owner choose the caps.

## Auth (for money-moving calls)
HMAC agent key issued by the operator. On each signed request:
```
X-Ace-Agent-Key:        ag_…                     (your key id)
X-Ace-Agent-Timestamp:  <unix SECONDS, ±300s window>
X-Ace-Agent-Sign:       hex( HMAC-SHA256( signing_string, key ) )
```
- **signing_string** = `METHOD + "\n" + ROUTE + "\n" + TIMESTAMP + "\n" + BODY`
- **ROUTE** = the REST route, e.g. `/acechange-agent/v1/swap/quote`. The
  `/wp-json`-prefixed form (`/wp-json/acechange-agent/v1/swap/quote`) is **also
  accepted**, so both conventions verify.
- **BODY** = the exact raw request body; **empty string `""` for GET**.
- **key** = `hex(sha256(secret))` — the HMAC key is the hex SHA-256 of your
  issued secret (the open-source SDKs do this for you).
- Per-key caps apply: per-minute velocity, daily USD, per-tx USD. **`est_usd`
  (the USD value, > 0) is REQUIRED** on `swap/submit`, `pay` and `ff/create` so
  the caps can be enforced — a request without it is rejected (`est_usd_required`).

## Swap rails
| Rail | What | Min | Custody |
|---|---|---|---|
| **micro** | same-chain swap on **Base** via **0x Gasless** (agent signs, relayer executes, gasless) | none (gas only) | non-custodial |
| **cross_chain** | **real cross-chain** swaps (native BTC, USDT TRC20/ERC20, XMR, …) via an external cross-chain provider | per-pair min (~$60+) | non-custodial (you deposit from your own wallet) |

Curated micro tokens: USDC, WETH, ETH, cbBTC, DAI (Base). Discover cross-chain
currencies with `GET /ff/currencies`.

### Micro-swap (Base, gasless)
1. `POST /swap/quote` `{ sell, buy, amount, taker }` → price + the EIP-712 trade
   to sign (0x Gasless v2 shape) + the AceChange 0.5 % integrator fee baked in.
2. Agent signs the trade with its own key.
3. `POST /swap/submit` `{ signed, est_usd }` → relayed to the 0x relayer.
4. `GET /swap/status?trade_hash=…`.

### Cross-chain (real BTC / USDT / XMR)
1. `GET /ff/currencies` → valid currency codes (BTC, USDTTRC20, XMR, …).
2. `POST /ff/estimate` `{ from, to, amount, type?, direction? }` → rate + amounts.
3. `POST /ff/create` `{ from, to, amount, toAddress, type?, tag?, est_usd,
   idempotency_key? }` → returns the **deposit** address+amount (where YOU send,
   from your own wallet) + the **receive** block + `status_url`. Pass an
   `idempotency_key` so a retry never creates a second order.
4. `GET /ff/status?order=…` (scoped to your key).

## Pay anyone (non-custodial)
`POST /pay` `{ to, token, amount, from?, est_usd }` — builds a payment to **any
Base address** (token ∈ USDC/WETH/ETH/DAI/cbBTC, or native ETH). AceChange
enforces your spend caps and returns an
unsigned `tx { chainId, to, value, data }` for the **agent to sign + broadcast**.
We never hold funds. MCP tool: `ace_pay`. Over-precision amounts and blocked
recipients are refused.

## Pay-per-call (metered access)
### x402 (USDC on Base) — `GET /x402/premium`
HTTP **402** with payment requirements (USDC, payTo, amount). Agent signs an
EIP-3009 `transferWithAuthorization`, retries with a base64 `X-PAYMENT` header.
We verify+settle via a facilitator and return the resource + `X-PAYMENT-RESPONSE`.
*(x402 v1 wire format; v2 is on the roadmap — v1 remains supported by facilitators.)*
Status: `GET /x402/info`. IP-rate-limited.

### L402 (Bitcoin Lightning) — `GET /l402/premium`
HTTP **402** + `WWW-Authenticate: L402 token="…", invoice="lnbc…"`. Pay the
invoice, retry with `Authorization: L402 <token>:<preimage>`. The credential is
**single-use** (one paid call). L402-**inspired** (opaque HMAC token binding the
payment_hash, not a full macaroon). Status: `GET /l402/info`. IP-rate-limited.

## Commerce ("Stripe for agents", non-custodial)
Register a merchant (your OWN wallet), list products, take checkouts whose
`pay_to` is ALWAYS your wallet. Fully usable via MCP:
`ace_register_merchant` → `ace_create_product` → `ace_create_checkout` →
`ace_order_status`. REST: `/commerce/{merchant,product,products,checkout,confirm,
order,watch}`. Webhook URLs must be **public HTTPS** (private/loopback rejected).
The hosted human checkout page (QR + wallet deep link) confirms on-chain
automatically (Etherscan) once paid.

## Wallet registry (non-custodial)
Store ONLY public addresses + session-key policy (caps/allowlists/expiry) +
ERC-4337 smart-account refs; private keys live in the SDK. `GET /wallet/provision`,
`POST /wallet/{register,smart-account,session,revoke}`, `GET /wallet/policy`.

## Activity / visibility (what your bot is doing)
- **Programmatic:** `GET /activity` (agent-auth) → your bot's own history (swaps,
  payments, cross-chain, commerce) with amounts, fees, status, time + running
  totals. MCP: `ace_activity`. Scoped to your key only.
- **For a human owner:** the operator gives you a **read-only link** that carries
  your key + a `viewer_token` (e.g. `…/agent-activity/?key=ag_…&token=…`). It
  renders a live dashboard (powered by the public, token-gated `GET /activity/view`).
  The viewer token is READ-ONLY — it can never transact. The operator also sees
  every agent's activity + earned fees in WP Admin → 🧾 Agent Ledger.

## MCP (Model Context Protocol)
`POST /mcp` — JSON-RPC 2.0 over HTTP. Methods: `initialize` (negotiates
`protocolVersion`, latest `2025-06-18`), `tools/list` (public), `tools/call`
(agent-auth). **Tools:** `ace_currencies`, `ace_limits`, `ace_activity`,
`ace_events`, `ace_fund`, `ace_swap_quote`, `ace_swap_submit`, `ace_swap_status`,
`ace_pay`, `ace_ff_currencies`, `ace_ff_estimate`, `ace_ff_create`, `ace_ff_status`,
`ace_register_merchant`, `ace_create_product`, `ace_create_checkout`,
`ace_order_status`, `ace_create_subscription`, `ace_record_usage`, `ace_invoice`. Tool **execution**
failures return `result.isError = true` (read the message + retry); unknown tool /
bad arguments return a JSON-RPC `error` (`-32602`).

## Reliability — events & webhooks
- `GET /events` (authed) → your recent events. Or **subscribe**:
  `POST /webhooks/register {url}` (public HTTPS only) → returns a `secret`; we POST
  every event signed `X-Ace-Event-Signature: HMAC-SHA256(body, secret)`.
  `GET /webhooks`, `POST /webhooks/delete {url}`. Events: `swap.submitted`,
  `swap.created`, `swap.completed|refunded|expired`, `payment.built`, `order.paid`,
  `order.refunded`, `order.delivered`, `subscription.due`, `invoice.created`.

## Recurring billing & usage
- `POST /billing/subscription {amount_usd, period(day|week|month), label?}` — a daily
  cron raises an invoice (a checkout to your wallet) each cycle and fires
  `subscription.due`. `GET /billing/subscriptions`, `POST /billing/cancel`.
- `POST /billing/usage {meter, units, unit_price_usd}` then
  `POST /billing/invoice {meter}` → one checkout for the metered total.
  Non-custodial: we invoice, the payer settles — we never auto-debit.

## Refunds, delivery & cross-chain emergency
- `POST /commerce/refund {order_id, to_address}` — builds a reverse USDC transfer
  the **merchant signs** to return funds; marks the order refunded (non-custodial).
- `POST /commerce/deliver {order_id}` — mark a paid order delivered (status signal;
  true hold-and-release escrow needs an audited on-chain escrow contract — deferred).
- `POST /ff/emergency {order_id, choice(EXCHANGE|REFUND), address?}` — act on a
  stuck cross-chain order (provider emergency action).

## Funding (fiat on-ramp)
- `GET /fund/link?wallet=&amount=&crypto=&network=` → a fiat→crypto on-ramp link
  pre-filled to the agent wallet. A **human** completes the payment; crypto is
  delivered to the agent (agents can't card-pay themselves). MCP: `ace_fund`.

## Errors (machine-readable)
Shape: `{ code, message, data: { status } }`. Branch on `code`. Common:
| code | HTTP | meaning | retry? |
|---|---|---|---|
| `agent_disabled` | 503 | module off | no |
| `agent_auth` | 401 | bad/missing key, ts, or signature | no |
| `rate_limited` | 429 | velocity / IP limit | backoff |
| `est_usd_required` | 400 | pass est_usd > 0 | fix + retry |
| `tx_too_large` | 403 | over per-tx cap | lower amount |
| `daily_cap` | 403 | over daily USD cap | wait (UTC day) |
| `*_not_configured` | 503 | rail not set up by operator | no |
| `ff_upstream` / `upstream` | 502 | cross-chain provider error (msg carries a provider code) | maybe |
| `no_order` | 404 | unknown order | no |

## llms.txt snippet (operator: paste into your live llms.txt)
```
## For AI agents
AceChange offers a non-custodial Agent API: crypto swaps (Base micro + real
cross-chain BTC/USDT/XMR), pay-anyone, metered pay-per-call (x402/L402), a
non-custodial wallet registry, and "Stripe for agents" commerce.
- Capability card: https://www.acechange.io/wp-json/acechange-agent/v1/agent
- MCP endpoint:    https://www.acechange.io/wp-json/acechange-agent/v1/mcp
- Request a key at info@acechange.io.
```

## Honesty / limits
- Sub-dollar **swaps** only on the Base micro rail (the cross-chain provider has minimums).
- Live smoke-test the 0x key, x402 facilitator and Lightning backend before
  production.
- Verify everything against the **live** server: the machine-readable
  [capability card](https://www.acechange.io/wp-json/acechange-agent/v1/agent)
  and [health endpoint](https://www.acechange.io/wp-json/acechange-agent/v1/health)
  are the source of truth — this document is a human-readable mirror.
