# Contributing

Thanks for helping build a safer wallet for AI agents.

- **Security-first.** This code signs value. No custom crypto; prefer audited
  libraries (viem / eth-account / audited ERC-4337 modules).
- **Tests required** for any logic change (`npm test` / `pytest`).
- **No secrets** in code, tests, or fixtures. Keystores/keys are never committed.
- **Non-custodial invariant:** nothing may transmit a private key off the host.
- Run `npm run typecheck` before a PR. Keep the TS and Python SDKs in parity.
- By contributing you agree to the MIT license.
