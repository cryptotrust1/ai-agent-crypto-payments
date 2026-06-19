/**
 * Client-side spending policy (mirrors the server session policy for fast,
 * local rejection before any network call). The server enforces again — this is
 * defence in depth, not the only gate.
 */
export interface Policy {
  perTxUsd?: number;
  dailyUsd?: number;
  allowedTokens?: string[];     // e.g. ["USDC","WETH"] — empty/undefined = any
  allowedRecipients?: string[]; // 0x… lowercased — empty/undefined = any
}

let spentToday = 0;
let spentDay = '';

export function localPolicyCheck(p: Policy, tx: { token: string; recipient: string; estUsd: number }): { ok: boolean; reason?: string } {
  if (p.allowedTokens?.length && !p.allowedTokens.map((t) => t.toUpperCase()).includes(tx.token.toUpperCase())) {
    return { ok: false, reason: 'token not allowed' };
  }
  if (p.allowedRecipients?.length && !p.allowedRecipients.map((r) => r.toLowerCase()).includes(tx.recipient.toLowerCase())) {
    return { ok: false, reason: 'recipient not allowed' };
  }
  if (p.perTxUsd && tx.estUsd > p.perTxUsd) return { ok: false, reason: 'over per-tx cap' };
  if (p.dailyUsd) {
    const day = new Date().toISOString().slice(0, 10);
    if (day !== spentDay) { spentDay = day; spentToday = 0; }
    if (spentToday + tx.estUsd > p.dailyUsd) return { ok: false, reason: 'over daily cap' };
    spentToday += tx.estUsd;
  }
  return { ok: true };
}
