/**
 * Quickstart — AceChange non-custodial agent wallet (TypeScript).
 *   npm install @acechange/agent-wallet viem
 *   WALLET_PASS=… ACE_AGENT_KEY=ag_… ACE_AGENT_SECRET=… node quickstart.js
 */
import { AgentWallet } from '@acechange/agent-wallet';

const opts = {
  acechange: {
    baseUrl: process.env.ACECHANGE_URL ?? 'https://www.acechange.io',
    keyId: process.env.ACE_AGENT_KEY!,
    secret: process.env.ACE_AGENT_SECRET!,
  },
  rpcUrl: 'https://mainnet.base.org',
  policy: { perTxUsd: 25, dailyUsd: 100, allowedTokens: ['USDC'] },
};

const w = AgentWallet.create('./agent.keystore.json', process.env.WALLET_PASS!, opts);
console.log('agent address:', w.address);

await w.api.walletRegister({ owner_address: w.address });
await w.api.walletSession({
  session_address: w.address,
  per_tx_usd: 25, daily_usd: 100, allowed_tokens: 'USDC', expires_in: 86400,
});

// Pay anyone — non-custodial (AceChange builds + screens, the wallet signs).
const hash = await w.pay('0x000000000000000000000000000000000000dEaD', 'USDC', '5', 5, w.address);
console.log('paid:', hash);
