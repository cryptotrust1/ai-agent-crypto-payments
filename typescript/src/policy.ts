/**
 * Client-side spending policy (mirrors the server session policy for fast,
 * local rejection before any network call). The server enforces again — this is
 * defence in depth, not the only gate.
 */

// ─── DACS-Standard Guardrail (§9.5.7 & §14.4) ─────────────────────────────

export interface DacsMandateMeta {
  /** Signed DACS mandate identifier or URI. */
  dacsMandate?: string;
  /** Active DACS session identifier. */
  dacsSessionId?: string;
  /** Hard authorized spend ceiling in USD (or numeric string). */
  dacsMaxAmount?: number | string;
}

export function assertDacsSpendMandate(
  requestedUsd: number,
  meta?: DacsMandateMeta
): void {
  if (!meta || (!meta.dacsMandate && !meta.dacsSessionId)) {
    return;
  }

  if (meta.dacsMaxAmount !== undefined) {
    const ceiling = Number(meta.dacsMaxAmount);
    if (!Number.isFinite(ceiling) || ceiling < 0) {
      throw new Error(
        `[DACS-Standard §9.5.7] Invalid dacsMaxAmount ceiling: "${meta.dacsMaxAmount}".`
      );
    }

    if (requestedUsd > ceiling) {
      throw new Error(
        `[DACS-Standard §9.5.7] AgentWallet execution aborted: requested spend ($${requestedUsd}) exceeds authorized mandate ceiling ($${ceiling}).`
      );
    }
  }
}

export interface Policy extends DacsMandateMeta {
  perTxUsd?: number;
  dailyUsd?: number;
  allowedTokens?: string[];     // e.g. ["USDC","WETH"] — empty/undefined = any
  allowedRecipients?: string[]; // 0x… lowercased — empty/undefined = any
}

let spentToday = 0;
let spentDay = '';

export function localPolicyCheck(
  p: Policy,
  tx: { token: string; recipient: string; estUsd: number; dacsMeta?: DacsMandateMeta }
): { ok: boolean; reason?: string } {
  // DACS-Standard (§9.5.7) Pre-Flight Mandate Enforcement
  const effectiveMeta: DacsMandateMeta = {
    dacsMandate: tx.dacsMeta?.dacsMandate ?? p.dacsMandate,
    dacsSessionId: tx.dacsMeta?.dacsSessionId ?? p.dacsSessionId,
    dacsMaxAmount: tx.dacsMeta?.dacsMaxAmount ?? p.dacsMaxAmount,
  };
  assertDacsSpendMandate(tx.estUsd, effectiveMeta);

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
