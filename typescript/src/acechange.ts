/**
 * Signed client for the AceChange Agent API (acechange-agent/v1).
 * Auth: HMAC-SHA256 over "METHOD\nROUTE\nTS\nBODY" keyed by sha256(secret),
 * matching FFE_Agent_Keys::authenticate() on the server.
 */
import { createHash, createHmac } from 'node:crypto';

export interface AceChangeConfig {
  baseUrl: string;   // e.g. https://www.acechange.io
  keyId: string;     // ag_…
  secret: string;    // issued once by the operator
}

const NS = '/wp-json/acechange-agent/v1';

export class AceChangeAgent {
  constructor(private cfg: AceChangeConfig) {}

  private sign(method: string, route: string, ts: number, body: string): string {
    const key = createHash('sha256').update(this.cfg.secret).digest('hex');
    return createHmac('sha256', key).update(`${method}\n${route}\n${ts}\n${body}`).digest('hex');
  }

  private async call(method: 'GET' | 'POST', path: string, json?: unknown): Promise<any> {
    const route = `${NS}${path}`;
    const ts = Math.floor(Date.now() / 1000);
    const body = json ? JSON.stringify(json) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Ace-Agent-Key': this.cfg.keyId,
      'X-Ace-Agent-Timestamp': String(ts),
      'X-Ace-Agent-Sign': this.sign(method, route, ts, body),
    };
    const res = await fetch(`${this.cfg.baseUrl}${route}`, { method, headers, body: body || undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`AceChange ${path} → ${res.status}: ${JSON.stringify(data)}`);
    return data;
  }

  // ---- swaps (non-custodial; you sign the returned payload) ----
  swapQuote(p: { sell: string; buy: string; amount: string; taker: string }) { return this.call('POST', '/swap/quote', p); }
  swapSubmit(p: { signed: unknown; est_usd?: number }) { return this.call('POST', '/swap/submit', p); }

  // ---- pay anyone (non-custodial; returns a tx for you to sign) ----
  pay(p: { to: string; token: string; amount: string; from?: string; est_usd?: number; session?: string }) { return this.call('POST', '/pay', p); }

  // ---- wallet registry (public addresses + policy only) ----
  walletRegister(p: { owner_address: string; label?: string }) { return this.call('POST', '/wallet/register', p); }
  walletSession(p: { session_address: string; per_tx_usd?: number; daily_usd?: number; allowed_tokens?: string; allowed_recipients?: string; expires_in?: number; label?: string }) { return this.call('POST', '/wallet/session', p); }
  walletRevoke(p: { session_address: string }) { return this.call('POST', '/wallet/revoke', p); }

  provision() { return this.call('GET', '/wallet/provision'); }
}
