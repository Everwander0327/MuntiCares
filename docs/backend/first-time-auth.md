# First-time account setup

Approved behavior: email signup creates a MuntiCares password and verifies a six-digit email code. A Google account that has not completed setup must also create a password and verify an additional code. Codes are delivered by Supabase Auth through existing Brevo SMTP. Email templates show Token, not ConfirmationURL. Codes expire after 10 minutes, with a 60-second resend cooldown and the existing 30-email/hour Auth limit.

`account-setup` validates JWTs itself and uses the signed-in account email, never a client-supplied recipient. Passwords pass directly to Supabase Auth, never app tables or logs. Supabase validates OTPs; completion is written through a service-role-only function. Temporary sessions from server-side OTP verification are revoked locally. Completion status checks an actual password plus email confirmation, and requires a server-owned completion row for Google-created accounts. Existing confirmed email/password accounts are ready, including the administrator.

AuthContext fetches setup status from an authenticated RPC. ProtectedRoute and AuthPage send pending users to password/code setup before onboarding. Signup can resume the code screen after an unconfirmed-email login attempt. Google signup still defaults to patient; provider signup uses the existing registration path.

## Deployment evidence
- Additive completion table/RPC migration and account-setup Edge Function deployed.
- Confirmation and magic-link code templates, 600-second expiry and 60-second cooldown deployed. Google and Brevo credentials were preserved.
- 13 focused tests passed; frontend production build passed. Admin exemption, pending Google status and restricted completion RPC privileges verified on the database. Unauthenticated setup endpoint returned 401.
- Actual inbox delivery and user-entered OTP verification still require a real signup test after frontend deployment.

## Pending API enforcement
Automatic approval review rejected the proposed broad restrictive RLS gate across application tables, Storage and Realtime because it could disrupt existing access. Those policies were not deployed. Current portal gating is at the UI/router; server owns completion but existing direct data API access rules remain unchanged. A separate, explicitly approved policy rollout and regression tests are needed to make setup completion an additional condition on all data access.

## Session handoff fix
Admin password updates revoke old sessions. The setup endpoint now authenticates the same account with the newly saved password and returns a replacement session over a no-store response. The client persists that session before sending a code. On OTP completion, it adopts the verified OTP session instead of revoking it. A 401 or missing browser session produces an explicit Sign in again recovery screen. A read-only authenticated RPC reports whether the current account has a password, allowing code-step resume without storing passwords in the browser.
