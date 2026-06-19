/**
 * 0x Gasless v2 signing (Phase 2). The /gasless/quote response contains EIP-712
 * objects the agent must sign: a `trade` and (when an allowance is needed) an
 * `approval`. We sign each locally with the agent's key and assemble the
 * /gasless/submit payload — fully non-custodial.
 *
 * The field names follow 0x's documented v2 Gasless API. Verify once against a
 * live 0x key (response shapes can evolve); the signing itself is standard
 * EIP-712 via viem.
 */
import type { LocalAccount } from 'viem';

interface Eip712 {
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  primaryType: string;
  message: Record<string, unknown>;
}
interface GaslessPart { type: string; eip712: Eip712; }
export interface GaslessQuote {
  chainId?: number;
  trade?: GaslessPart;
  approval?: GaslessPart;
}

async function sign712(account: LocalAccount, e: Eip712): Promise<`0x${string}`> {
  const types = { ...(e.types as Record<string, unknown>) };
  // viem derives EIP712Domain from `domain`; passing it in `types` is rejected.
  delete (types as Record<string, unknown>).EIP712Domain;
  return account.signTypedData({
    domain: e.domain as never,
    types: types as never,
    primaryType: e.primaryType as never,
    message: e.message as never,
  });
}

/** Sign the trade (+ approval if present) and build the submit payload. */
export async function signGaslessQuote(account: LocalAccount, quote: GaslessQuote): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { chainId: quote.chainId ?? 8453 };
  if (quote.approval?.eip712) {
    out.approval = { type: quote.approval.type, eip712: quote.approval.eip712, signature: await sign712(account, quote.approval.eip712) };
  }
  if (quote.trade?.eip712) {
    out.trade = { type: quote.trade.type, eip712: quote.trade.eip712, signature: await sign712(account, quote.trade.eip712) };
  } else {
    throw new Error('0x quote has no trade.eip712 to sign');
  }
  return out;
}
