/**
 * ERC-4337 smart account + on-chain session keys (Phase 2).
 *
 * IMPORTANT — use audited infrastructure, do NOT roll your own:
 *  - Smart account: an audited implementation (e.g. Coinbase Smart Wallet via
 *    viem `toCoinbaseSmartAccount`, or Safe/Kernel/Biconomy via their SDK).
 *  - Bundler + Paymaster: a provider (Pimlico / Coinbase CDP / Alchemy) — the
 *    operator supplies the URLs/keys. Paymaster = gasless (the bot needs no ETH).
 *  - Session keys: an audited module (ERC-7579 smart sessions / ZeroDev / Safe
 *    allowance module) that enforces caps ON-CHAIN.
 *
 * This file wires the flow with viem's account-abstraction primitives and marks
 * the exact provider integration points. A fund-holding deployment MUST be
 * security-audited first (see docs/AGENT-WALLET-SPEC.md).
 */
import { createPublicClient, http, type LocalAccount, type Address } from 'viem';
import { base } from 'viem/chains';

export interface SmartAccountConfig {
  owner: LocalAccount;     // the EOA that owns the smart account (key stays local)
  bundlerUrl: string;      // ERC-4337 bundler (provider)
  paymasterUrl?: string;   // gas sponsorship (provider) — omit = self-pay gas
  rpcUrl?: string;         // Base RPC
}

export interface SessionGrant {
  sessionAddress: Address;       // the session key's public address
  perTxUsd: number;
  dailyUsd: number;
  allowedTokens: Address[];      // on-chain token allowlist
  allowedRecipients: Address[];  // on-chain recipient allowlist (or [] = any)
  expiresAt: number;             // unix seconds
}

export class AgentSmartAccount {
  private pub;
  constructor(private cfg: SmartAccountConfig) {
    this.pub = createPublicClient({ chain: base, transport: http(cfg.rpcUrl) });
  }

  /**
   * Deploy / resolve the smart account for this owner.
   * INTEGRATION POINT: instantiate the audited account here, e.g.
   *   const account = await toCoinbaseSmartAccount({ client: this.pub, owners: [this.cfg.owner] });
   *   const bundler = createBundlerClient({ account, client: this.pub,
   *       transport: http(this.cfg.bundlerUrl), paymaster: this.cfg.paymasterUrl ? … : undefined });
   * Returns the smart-account address (deterministic counterfactual address).
   */
  async getAddress(): Promise<Address> {
    throw new Error('Phase 2: wire an audited ERC-4337 account (e.g. toCoinbaseSmartAccount) + bundler/paymaster, then return its address.');
  }

  /**
   * Grant a scoped on-chain SESSION KEY via an audited session-key module.
   * The OWNER signs the enable/permission; the module enforces caps on-chain.
   * Returns a permission reference to register with AceChange
   * (FFE_Agent_Wallet::add_session permission_ref) for off-chain double-enforcement.
   * INTEGRATION POINT: use ERC-7579 smart-sessions / ZeroDev / Safe module.
   */
  async grantSessionKey(_grant: SessionGrant): Promise<{ permissionRef: string }> {
    throw new Error('Phase 2: install an audited session-key module + sign the permission with the owner; return its on-chain permission id.');
  }

  /**
   * Send a gasless userOperation (paymaster-sponsored) from the smart account.
   * INTEGRATION POINT: bundlerClient.sendUserOperation({ calls: [{ to, data, value }] }).
   */
  async sendGasless(_call: { to: Address; data?: `0x${string}`; value?: bigint }): Promise<`0x${string}`> {
    throw new Error('Phase 2: send via the bundler client with paymaster sponsorship.');
  }
}
