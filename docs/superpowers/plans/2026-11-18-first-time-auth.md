# First-time auth implementation
Spec: ../specs/2026-11-18-first-time-auth-design.md
1. Add server-owned setup status and restricted completion RPC; gate application tables while pending.
2. Add authenticated account-setup Edge Function for password creation, OTP sending and verification against current account.
3. Deploy code email templates using a scoped config; preserve SMTP/OAuth settings.
4. Add signup OTP screen and Google password/code gate; refresh authoritative user status after verification.
5. Test rejection paths, setup routing and code verification, deploy backend and verify configuration and frontend build.

## Execution record
- Steps 1-4 implemented with an additive status migration and UI/router gate; broad RLS enforcement was rejected by automatic approval review and was not deployed.
- 13 focused tests passed, production build passed, focused lint has no errors (pre-existing AuthPage dependency warning).
- Live code-email configuration matches declared settings. Admin remains ready, passwordless Google user remains pending, authenticated users cannot execute completion directly.
- Frontend deployment, actual inbox/OTP smoke test and approval for additional direct-API gating remain outstanding.
