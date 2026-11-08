export function buildAuthUser(authUser, profile, hasError = false) {
  return {
    id: authUser.id,
    email: authUser.email,
    // A missing row is not "no role" — it means the account has no profile at all
    // (e.g. deleted by an admin), so it must not be synthesized into a patient.
    role: hasError || !profile ? null : profile?.role || 'patient',
    full_name: profile?.full_name || authUser.user_metadata?.full_name || '',
    avatar_url: profile?.avatar_url || authUser.user_metadata?.avatar_url || '',
    is_banned: profile?.is_banned || false,
  };
}

