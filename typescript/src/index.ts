/**
 * @acechange/agent-wallet — non-custodial wallet for AI agents.
 *
 * The agent holds its own key (encrypted keystore). High-level helpers ask the
 * AceChange Agent API to BUILD an intent (swap / pay), then sign + broadcast it
 * locally with viem. AceChange never holds funds.
 *
 * v1: local EOA on Base. v2 (planned): ERC-4337 smart account + on-chain
 * session keys (see docs/AGENT-WALLET-SPEC.md). Audit required before mainnet.
 */
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { createWalletClient, http, type Hex } from 'viem';
import { base } from 'viem/chains';
import { encryptPrivateKey, decryptPrivateKey, saveKeystore, loadKeystore } from './keystore.js';
import { AceChangeAgent, type AceChangeConfig } from './acechange.js';
import { localPolicyCheck, type Policy } from './policy.js';
import { signGaslessQuote } from './zerox.js';

export * from './keystore.js';
export * from './acechange.js';
export * from './policy.js';
export * from './zerox.js';
export * from './smart-account.js';

export interface WalletOptions {
  acechange: AceChangeConfig;
  rpcUrl?: string;       // Base RPC (defaults to a public endpoint)
  policy?: Policy;       // optional client-side caps mirroring the server session
}

export class AgentWallet {
  private account;
  private client;
  public api: AceChangeAgent;
  private policy?: Policy;

  private constructor(privateKey: Hex, opts: WalletOptions) {
    this.account = privateKeyToAccount(privateKey);
    this.client = createWalletClient({ account: this.account, chain: base, transport: http(opts.rpcUrl) });
    this.api = new AceChangeAgent(opts.acechange);
    this.policy = opts.policy;
  }

  /** Create a brand-new wallet, persisting an encrypted keystore. */
  static create(keystorePath: string, passphrase: string, opts: WalletOptions): AgentWallet {
    const pk = generatePrivateKey();
    saveKeystore(keystorePath, encryptPrivateKey(pk, passphrase));
    return new AgentWallet(pk, opts);
  }

  /** Load an existing wallet from an encrypted keystore. */
  static load(keystorePath: string, passphrase: string, opts: WalletOptions): AgentWallet {
    const pk = decryptPrivateKey(loadKeystore(keystorePath), passphrase);
    return new AgentWallet(pk, opts);
  }

  get address(): `0x${string}` { return this.account.address; }

  /** Non-custodial pay: AceChange builds + screens the tx; we sign & broadcast. */
  async pay(to: string, token: string, amount: string, estUsd = 0, session?: string): Promise<`0x${string}`> {
    if (this.policy) {
      const v = localPolicyCheck(this.policy, { token, recipient: to, estUsd });
      if (!v.ok) throw new Error(`local policy: ${v.reason}`);
    }
    const built = await this.api.pay({ to, token, amount, from: this.address, est_usd: estUsd, session });
    const tx = built.tx;
    return this.client.sendTransaction({
      to: tx.to as `0x${string}`,
      data: (tx.data ?? '0x') as `0x${string}`,
      value: BigInt(tx.value ?? '0x0'),
    });
  }

  /** Non-custodial micro-swap on Base (0x gasless): quote → sign → submit. */
  async swap(sell: string, buy: string, amount: string, estUsd = 0): Promise<any> {
    if (this.policy) {
      const v = localPolicyCheck(this.policy, { token: sell, recipient: this.address, estUsd });
      if (!v.ok) throw new Error(`local policy: ${v.reason}`);
    }
    const { quote } = await this.api.swapQuote({ sell, buy, amount, taker: this.address });
    // Agent signs the 0x Gasless EIP-712 payload locally, then AceChange relays it.
    const signed = await signGaslessQuote(this.account, quote);
    return this.api.swapSubmit({ signed, est_usd: estUsd });
  }
}
