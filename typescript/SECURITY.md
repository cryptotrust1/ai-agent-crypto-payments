# Security policy — @acechange/agent-wallet

This package signs cryptocurrency transactions. Treat it as security-critical.

## Status
Open-source reference (v0.x). **Not yet independently audited.** Do NOT hold
material funds with it until an audit is complete.

## Threat model & guarantees
- **Non-custodial:** the private key lives only on the machine running the SDK,
  in an AES-256-GCM encrypted keystore. It is never transmitted to AceChange or
  any server. AceChange stores only public addresses + policy.
- **Defence in depth:** spending caps/allowlists/expiry are enforced locally
  (SDK), off-chain (AceChange Agent API), and — in v2 — on-chain (ERC-4337
  session-key module).
- **Least privilege:** operate via short-lived, capped **session keys**, not the
  owner key. A compromised session key can lose at most its cap before expiry.
- **No custom crypto:** we use `viem` (TS) / `eth-account` + `web3` (Py) and, in
  v2, an audited ERC-4337 account + session module. We do not ship bespoke
  wallet contracts.

## Pre-production checklist (MUST)
- [ ] Independent security audit of the SDK + the chosen smart-account/session module.
- [ ] Live verification of the 0x Gasless typed-data shapes against a real 0x key.
- [ ] Bundler + paymaster provider configured (keys held by the operator).
- [ ] Keystore passphrase from a secrets manager / OS keyring, never hard-coded.
- [ ] Session-key caps + expiry set conservatively; kill-switch tested.

## Reporting a vulnerability
Email **security@acechange.io** (or info@acechange.io). Please do not open public
issues for vulnerabilities. We aim to acknowledge within 72 hours.
