# @acechange/agent-wallet

**Non-custodial, policy-scoped crypto wallet for AI agents.** The agent holds its
own key; AceChange **never** custodies funds. Built for **Base** + the
[AceChange Agent API](../docs/API.md).

> ⚠️ **Status: open-source reference scaffold (v0.1).** v1 is a local EOA; v2 adds
> an ERC-4337 smart account with on-chain **session keys**. A real, fund-holding
> wallet **must be independently security-audited before mainnet use.** See
> [`docs/AGENT-WALLET-SPEC.md`](../docs/WALLET-SPEC.md).

## Why it's "for AI agents"
- **Session keys with hard caps** — per-tx, daily, allowed tokens, allowed
  recipients, expiry. A compromised agent can lose at most a session's cap.
- **Kill switch** — revoke a session instantly (`walletRevoke`).
- **Policy enforced twice** — locally (this SDK) and server-side (AceChange).
- **Headless** — programmatic signing, no browser popups.
- **Non-custodial** — keys never leave the machine; AceChange only stores public
  addresses + policy.

## Install
```bash
npm install @acechange/agent-wallet viem
```

## Quickstart
```ts
import { AgentWallet } from '@acechange/agent-wallet';

const opts = {
  acechange: { baseUrl: 'https://www.acechange.io', keyId: 'ag_…', secret: '…' },
  rpcUrl: 'https://mainnet.base.org',
  policy: { perTxUsd: 25, dailyUsd: 100, allowedTokens: ['USDC'] },
};

// First run: create + persist an encrypted keystore (passphrase from env).
const w = AgentWallet.create('./agent.keystore.json', process.env.WALLET_PASS!, opts);
console.log('agent address', w.address);

// Register a scoped session key + policy with AceChange (public address only).
await w.api.walletRegister({ owner_address: w.address });
await w.api.walletSession({
  session_address: w.address,            // (v2: a separate session key)
  per_tx_usd: 25, daily_usd: 100,
  allowed_tokens: 'USDC',
  allowed_recipients: '0xRecipient…',     // or 'any'
  expires_in: 86400,
});

// Pay anyone (non-custodial): AceChange builds + screens; we sign & broadcast.
const hash = await w.pay('0xRecipient…', 'USDC', '5', /*estUsd*/ 5, /*session*/ w.address);
console.log('paid', hash);
```

## Security model
1. Private keys are stored in an **AES-256-GCM** encrypted keystore on the
   agent's machine — never uploaded.
2. AceChange stores only **public addresses + policy**; it cannot move funds.
3. **Don't roll your own crypto** — this SDK uses `viem` (audited) and (v2) an
   audited ERC-4337 account; we do not ship custom wallet contracts unaudited.
4. **Get an independent audit** before holding real funds.

## Roadmap
- v1: local EOA on Base, pay-anyone + micro-swap via AceChange. *(this scaffold)*
- v2: ERC-4337 smart account, on-chain session keys, paymaster (gasless), live
  0x Gasless typed-data signing.
- v3: Python port, agent-framework adapters, security audit, npm publish.

MIT licensed.
