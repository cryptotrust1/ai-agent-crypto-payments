# Changelog

## 0.1.0 (unreleased)
- Phase 1: non-custodial EOA wallet — encrypted keystore (AES-256-GCM), signed
  AceChange Agent API client, client-side policy, `pay()` (pay anyone) + `swap()`.
- Phase 2: real 0x Gasless v2 EIP-712 signing; ERC-4337 smart-account + session-key
  + paymaster scaffold (integration points for audited infra).
- Phase 3: Python port (`acechange-agent-wallet`), agent-framework adapters
  (LangChain tools, OpenAI/Anthropic function schemas), audit/publish prep.
- ⚠ Pre-1.0: requires an independent security audit before mainnet use.
