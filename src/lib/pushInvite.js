export function inviteFromPayload(data) {
  if (!data || data.kind !== 'call_invite') return null;
  return {
    senderId: data.sender_id,
    senderName: data.sender_name || '',
    callType: data.call_type === 'audio' ? 'audio' : 'video',
    callId: data.call_id || null,
    receiverId: data.receiver_id || null,
  };
}

export function shouldDeliverInvite(invite, currentUserId) {
  if (!invite || !invite.senderId) return false;
  // Legacy payloads omit receiver_id; accept them rather than breaking ring delivery
  // before the Edge Function rollout. New payloads must match the signed-in user so a
  // shared handset cannot ring one account for another account's call.
  if (!invite.receiverId) return true;
  return invite.receiverId === currentUserId;
}
