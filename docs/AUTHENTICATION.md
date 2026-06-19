# Authentication — HMAC request signing

Every money-moving request is signed with an HMAC key the operator issues you.
Read-only discovery (`GET /agent`, `GET /health`) needs no auth.

This is the **whole** algorithm — nothing hidden. The SDKs in this repo do
exactly this; you can diff your own implementation against it.

## Headers

```
X-Ace-Agent-Key:        ag_…                  your key id
X-Ace-Agent-Timestamp:  1718800000            unix SECONDS, ±300s window
X-Ace-Agent-Sign:       <hex hmac>            see below
```

## The signing string

```
signing_string = METHOD + "\n" + ROUTE + "\n" + TIMESTAMP + "\n" + BODY
```

- **METHOD** — `GET` / `POST` (upper-case).
- **ROUTE** — the namespaced route, e.g. `/acechange-agent/v1/pay`.
  The `/wp-json`-prefixed form (`/wp-json/acechange-agent/v1/pay`) is **also
  accepted**, so both conventions verify.
- **TIMESTAMP** — the same value you send in `X-Ace-Agent-Timestamp`.
- **BODY** — the **exact raw** request body bytes. For `GET` use the empty
  string `""`.

## The key

```
hmac_key = hex( sha256( your_secret ) )      # lower-case hex of the SHA-256 digest
signature = hex( HMAC_SHA256( signing_string, hmac_key ) )
```

> Note: the secret is **hashed to hex first**, and that hex string is the HMAC
> key. This is intentional and the SDKs do it for you.

`est_usd` (USD value, **> 0**) is **required** on `swap/submit`, `pay` and
`ff/create` so per-tx / daily caps can be enforced.

---

## Copy-paste examples

### curl (bash)
```bash
KEY="ag_xxx"; SECRET="your_secret"
TS=$(date +%s)
METHOD="POST"; ROUTE="/acechange-agent/v1/pay"
BODY='{"to":"0xRecipient","token":"USDC","amount":"5","est_usd":5}'

HMAC_KEY=$(printf '%s' "$SECRET" | openssl dgst -sha256 -r | cut -d' ' -f1)
SIGN=$(printf '%s\n%s\n%s\n%s' "$METHOD" "$ROUTE" "$TS" "$BODY" \
  | openssl dgst -sha256 -hmac "$HMAC_KEY" -r | cut -d' ' -f1)

curl -X POST "https://www.acechange.io$ROUTE" \
  -H "X-Ace-Agent-Key: $KEY" \
  -H "X-Ace-Agent-Timestamp: $TS" \
  -H "X-Ace-Agent-Sign: $SIGN" \
  -H "Content-Type: application/json" \
  -d "$BODY"
```

### Python
```python
import hashlib, hmac, time, json, requests

KEY, SECRET = "ag_xxx", "your_secret"
base = "https://www.acechange.io"
route = "/acechange-agent/v1/pay"
body = json.dumps({"to": "0xRecipient", "token": "USDC",
                   "amount": "5", "est_usd": 5}, separators=(",", ":"))
ts = str(int(time.time()))

hmac_key = hashlib.sha256(SECRET.encode()).hexdigest()
msg = f"POST\n{route}\n{ts}\n{body}"
sign = hmac.new(hmac_key.encode(), msg.encode(), hashlib.sha256).hexdigest()

r = requests.post(base + route, data=body, headers={
    "X-Ace-Agent-Key": KEY,
    "X-Ace-Agent-Timestamp": ts,
    "X-Ace-Agent-Sign": sign,
    "Content-Type": "application/json",
})
print(r.status_code, r.json())
```

### TypeScript / Node
```ts
import { createHash, createHmac } from 'crypto';

const KEY = 'ag_xxx', SECRET = 'your_secret';
const base = 'https://www.acechange.io';
const route = '/acechange-agent/v1/pay';
const body = JSON.stringify({ to: '0xRecipient', token: 'USDC', amount: '5', est_usd: 5 });
const ts = Math.floor(Date.now() / 1000).toString();

const hmacKey = createHash('sha256').update(SECRET).digest('hex');
const sign = createHmac('sha256', hmacKey)
  .update(`POST\n${route}\n${ts}\n${body}`).digest('hex');

const res = await fetch(base + route, {
  method: 'POST',
  headers: {
    'X-Ace-Agent-Key': KEY,
    'X-Ace-Agent-Timestamp': ts,
    'X-Ace-Agent-Sign': sign,
    'Content-Type': 'application/json',
  },
  body,
});
console.log(res.status, await res.json());
```

## Errors

If auth fails you get `{ "code": "agent_auth", "message": "…", "data": { "status": 401 } }`.
Full error table in [`API.md`](API.md#errors-machine-readable). Common causes:
clock skew > 300s, signing the wrong route/body, or hashing the secret wrong
(remember: HMAC key = **hex(sha256(secret))**, not the raw secret).
