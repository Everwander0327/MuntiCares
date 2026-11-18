# Google sign-in

Web Google OAuth uses Supabase Auth and the existing session/profile listener. Database roles remain authoritative. Existing verified matching emails can link automatically through Supabase. New accounts choose Patient or Provider in a dedicated first-time setup step after authentication. Existing accounts retain their role. Google users still complete patient onboarding. The Google button requires privacy/terms acceptance and requests only openid/email/profile. Google signup avoids confirmation SMTP messages but still counts toward Auth usage.

## Required live configuration
Create a Web application OAuth client in Google Cloud. Add the deployed website origin to Authorized JavaScript origins. Add `https://zsqowrouxuxjjmosbvxt.supabase.co/auth/v1/callback` as the Authorized redirect URI. Configure branding, audience and basic scopes. Add the client ID and secret in Supabase Dashboard > Authentication > Sign In / Providers > Google and enable it. Keep the secret out of VITE variables and the repository. Add each deployed site `/login` URL to the Supabase Auth redirect allowlist.

Verify Google cancellation, existing patient/provider login, new patient onboarding, denied privacy acceptance and banned accounts. Actual OAuth verification requires configured Google credentials and a user-controlled Google login.

## One Tap
Google Identity Services loads only after explicit privacy consent on the login/patient registration screen. It uses the public Google client ID in src/lib/googleClientId.js, SHA-256 nonce binding and Supabase signInWithIdToken. Automatic account selection is disabled. Consent withdrawal or unmount cancels the prompt and ignores late credentials. The redirect button remains available when the browser suppresses One Tap. Google Cloud Authorized JavaScript origins must include the exact deployed origin and any development origin used for testing. Browser settings control prompt visibility and position.

All application-owned auth/setup stages now render inside the AuthPage right panel, including the opening-portal state. Password and confirm-password fields have independent accessible show/hide controls. Account role choices are server-owned, immutable after first selection, and cannot include administrator. Existing role-specific profile rows are preserved.
