# Auth panel role implementation
1. Add server-owned one-time role choices, preserve existing roles, and protect role mutation behind authenticated setup endpoint.
2. Add role step and accessible password eye toggles to AccountSetup.
3. Embed setup and loading states in the shared AuthPage right panel; remove registration role pills.
4. Test selection sequencing, password toggles, role immutability and layout, then build and deploy backend.

Verified: 14 focused tests passed; production build passed; lint has no errors (existing AuthPage dependency warning). Real AuthPage was tested in Chrome with intercepted signup: left hero remained visible on role and code steps, original role pills were absent, mobile had no horizontal overflow. Existing role values were preserved and direct client writes/role RPC execution were denied. Backend migration and account-setup v3 deployed. Frontend deployment and live user OTP testing remain outstanding.
