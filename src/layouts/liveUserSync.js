export function liveUserRowToAction(row) {
  const isBanned = Boolean(row?.is_banned);
  return {
    signOut: isBanned,
    fullName: row?.full_name ?? null,
    avatarUrl: row?.avatar_url ?? null,
  };
}
