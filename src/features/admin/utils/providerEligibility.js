export function canApproveProvider(provider) {
  return Boolean(
    provider &&
    !provider.is_banned &&
    !provider.is_approved &&
    provider.is_profile_complete
  );
}
