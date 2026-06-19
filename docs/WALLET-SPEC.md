# AceChange Agent Wallet — non-custodial wallet for AI bots (DETAILED PLAN)

> **Status:** PLAN + Phase-1 foundation. Owner approved: build a non-custodial,
> bot-adapted wallet, open-source OK.
> **Date:** 2026-06-18
> **Hard rule (non-negotiable):** private keys live **with the bot** (client
> side), **never** on the AceChange server. If the server ever held/generated
> keys it would be custodial = money-transmitter + honeypot. AceChange provides
> only the **policy/registry layer + Agent API**; the wallet (key + signing) is
> the open-source **SDK** the bot runs.

---

## 0. Why a special wallet for AI bots (not just "a private key")

A raw EOA (one private key) is non-custodial but **dangerous for an autonomous
agent**: if the agent (or its host) is compromised, the whole balance is gone.
A bot-adapted wallet adds guardrails a human normally provides by clicking
"reject":

- **Session keys** — short-lived, scoped keys the bot signs with, instead of the
  master key. Each has hard caps (per-tx, daily, allowed tokens, allowed
  recipients, expiry). A leaked session key can lose at most its cap.
- **Spending policies + allowlists** — enforced **on-chain** (smart account) AND
  **off-chain** (AceChange Agent API) = defence in depth.
- **Kill switch** — revoke a session key instantly (on-chain + registry).
- **Gas abstraction** — paymaster so the bot needs no ETH.
- **Headless + deterministic** — no browser popups; programmatic signing; plugs
  into agent frameworks + MCP.
- **Audit** — every signed action logged.

---

## 1. Architecture

```
        AI bot (autonomous)
            │ uses
            ▼
   ┌──────────────────────────────┐   keys NEVER leave here
   │ @acechange/agent-wallet SDK   │   (open-source, MIT)
   │  - keystore (encrypted, local)│
   │  - account (EOA → smart acct) │
   │  - session keys + policy       │
   │  - signer (EIP-712 / userOp)   │
   │  - AceChange Agent API client  │
   └───────────────┬───────────────┘
        signs intents │ registers PUBLIC address + policy
                      ▼
   ┌──────────────────────────────┐
   │ AceChange plugin (server)     │   NEVER sees private keys
   │  - FFE_Agent_Wallet registry  │   (public address + policy only)
   │  - policy double-enforcement   │
   │  - Agent API (swap/pay/x402)   │   builds intents → SDK signs
   │  - audit + revocation          │
   └───────────────┬───────────────┘
                    ▼
   Base (ERC-4337 bundler + paymaster) · 0x · facilitators
```

**Loop:** bot asks "swap"/"pay" → Agent API **builds** the intent → **SDK signs**
with a session key (within policy) → broadcast (bundler/relayer) on Base.
AceChange never holds, never signs, never custodies.

---

## 2. Key & account model (phased)

- **v1 — local EOA (simplest non-custodial).** SDK generates a private key,
  stores it in an **encrypted keystore** (AES-256-GCM, scrypt/PBKDF2 from a
  passphrase or OS keyring), signs locally with **viem/ethers** (audited libs).
  Non-custodial by definition. No session keys yet (the EOA *is* the key) — so
  policy is enforced by the SDK + AceChange API, not on-chain.
- **v2 — ERC-4337 smart account + session keys (the bot-adapted core).** The EOA
  becomes the *owner* of a **smart account**; the bot operates via **session
  keys** with on-chain caps. Use an **existing, audited modular smart-account
  stack** (e.g. a well-known ERC-4337 account + a bundler/paymaster provider).
  **We do NOT write our own wallet Solidity** — rolling your own wallet contract
  without an audit is how funds get lost. We integrate audited modules + a
  session-key/policy module.
- **v3 (optional) — EIP-7702** to let an existing agent EOA temporarily gain
  smart-account powers without redeploying.

---

## 3. Components

### 3a. Open-source SDK `@acechange/agent-wallet` (TypeScript first)
```
agent-wallet/
  package.json            MIT, deps: viem (audited)
  README.md               quickstart + security model
  src/
    keystore.ts           AES-256-GCM encrypted local keystore (never uploaded)
    account.ts            EOA now; smart-account (4337) in v2
    policy.ts             client-side caps (per-tx, daily, tokens, recipients, expiry)
    session.ts            create/rotate/revoke session keys (v2)
    acechange.ts          Agent API client (signed): swap_quote/submit, pay, x402, l402, wallet/*
    signer.ts             EIP-712 / tx / userOp signing
    index.ts              public API + a tiny CLI
  test/                   unit tests (vitest)
```
Python port later (same interfaces).

### 3b. AceChange plugin (server) — `FFE_Agent_Wallet` (non-custodial registry)
- Stores **only** the bot's **public** address(es) + **policy** (caps, allow-
  lists, expiry, status). **No private keys, ever.**
- `register_wallet(key_id, owner_address, label)`
- `add_session(key_id, session_address, caps…)` — register a session key's public
  address + its policy.
- `get_policy(session_address)` / `revoke(session_address)` (kill switch)
- `enforce(session_address, token, recipient, est_usd)` → ok | WP_Error — the
  Agent API (`/pay`, `/swap/submit`) calls this as **off-chain double-enforcement**
  before building an intent.
- `provision()` → returns chain + recommended limits + SDK link (NO keys).
- Audit via `do_action('ffe_agent_wallet_event', …)`.

### 3c. REST (namespace acechange-agent/v1)
```
GET  /wallet/provision           setup config (public, gated) — never keys
POST /wallet/register   (auth)   register bot owner/public address
POST /wallet/session    (auth)   register a session key + its caps/allowlist/expiry
GET  /wallet/policy     (auth)   read a session's policy/status
POST /wallet/revoke     (auth)   kill switch — revoke a session key
```

---

## 4. Session-key policy (the heart of "bot-adapted")
Each session key carries:
- `per_tx_usd` — max value per action
- `daily_usd` — rolling daily cap
- `allowed_tokens` — e.g. USDC,WETH (or "any")
- `allowed_recipients` — explicit allowlist, or "any" (with OFAC screen always on)
- `expires_at` — auto-expiry
- `status` — active | revoked

Enforced **twice**: on-chain by the smart account (v2) and off-chain by
`FFE_Agent_Wallet::enforce()` in the Agent API. Either can reject.

---

## 5. Security model (must-dos, honest)
- 🔴 **Keys never touch AceChange.** Server stores public addresses + policy only.
- 🔴 **Don't roll your own crypto/contracts.** Use viem/ethers (audited) + an
  audited ERC-4337 account. A custom wallet contract **must** be audited before
  it holds real funds.
- 🔴 **Independent security audit before mainnet with real funds.** Non-negotiable
  for anything that signs value.
- 🟠 Encrypted keystore (AES-256-GCM); passphrase via env/OS keyring, never logged.
- 🟠 Session keys default-deny: short expiry, tight caps, allowlist.
- 🟠 OFAC/blacklist screen on every recipient (already built: `ffe_agent_screen_recipient`).
- 🟠 Kill switch revokes instantly (registry + on-chain in v2).
- 🟠 Full audit trail.

---

## 6. Open-source plan
- License **MIT**; package `@acechange/agent-wallet`; public repo + npm.
- Ships: SDK + policy templates + docs. Builds trust + distribution + ecosystem
  (agents adopt the wallet → they swap/pay through AceChange).
- The PHP registry stays in this plugin (server side).

---

## 7. Phases & deliverables
1. **Phase 1 (now):** PHP `FFE_Agent_Wallet` non-custodial registry/policy/
   session/enforce/revoke + REST + tests. SDK **scaffold** (structure + interfaces
   + encrypted keystore + Agent API client), v1 local EOA.
2. **Phase 2:** SDK ERC-4337 smart account + on-chain session keys + paymaster
   (integrate audited stack). Wire `enforce()` into `/pay` + `/swap/submit`.
3. **Phase 3 (done — code):** Python SDK port (`agent-wallet-py/`,
   `acechange-agent-wallet`) with a keystore cross-compatible with the TS SDK;
   agent-framework adapters (`agent-wallet/examples/`: LangChain tools, OpenAI/
   Anthropic function schemas, TS quickstart); audit/publish prep (SECURITY.md
   with pre-prod checklist, CHANGELOG, CONTRIBUTING, .npmignore). **Still pending
   before 1.0: the independent security audit + npm/PyPI publish + live 0x /
   bundler / paymaster wiring.**

---

## 8. Honest limitations
- A real, fund-holding wallet **needs a security audit** before production — this
  plan does not skip that.
- The SDK runs **where the bot runs**; AceChange can't recover a lost key (that's
  what non-custodial means — document aggressively, encourage backups).
- Smart-account / paymaster needs a bundler + paymaster provider (config/keys the
  bot or operator supplies).
- v1 EOA has no on-chain caps (only SDK + API enforcement); on-chain caps arrive
  with v2 smart accounts.
