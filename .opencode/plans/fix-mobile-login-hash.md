# Fix mobile login: SHA-256 pure JS fallback

## Problem
On mobile, accessing via LAN IP (e.g., `192.168.x.x:5173`) is **not** a secure context, so `crypto.subtle` is `undefined`. The previous pure JS SHA-256 fallback had a compression-loop bug (signed integer overflow from `~`/bitwise ops) — passes empty string but produces wrong hashes for all non-empty inputs, causing "Invalid email or password".

## Root Cause
`src/lib/hash.js` — `sha256Pure()` function. Bug confirmed: empty string matches, but "abc" and "test123" produce incorrect hashes.

## Fix
Replace the entire file with a verified SHA-256 implementation (Chris Veness, public domain):
- Uses `safe_add()` splitting into high/low 16-bit words to avoid JavaScript's signed 32-bit integer issues
- Pattern: try `crypto.subtle` first, fall back to pure JS

## Verification
Tested against 5 vectors (empty, `abc`, `test123`, `hello world`, `password123!`) — all PASS.

## File changed
- `src/lib/hash.js` — full rewrite
