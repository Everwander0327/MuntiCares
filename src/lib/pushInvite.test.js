import { describe, it, expect } from 'vitest';
import { inviteFromPayload, shouldDeliverInvite } from './pushInvite';

describe('inviteFromPayload', () => {
  it('parses a call_invite payload including the receiver', () => {
    const invite = inviteFromPayload({
      kind: 'call_invite',
      call_id: 'c1',
      sender_id: 's1',
      sender_name: 'Dr A',
      call_type: 'video',
      receiver_id: 'r1',
    });
    expect(invite).toEqual({
      senderId: 's1',
      senderName: 'Dr A',
      callType: 'video',
      callId: 'c1',
      receiverId: 'r1',
    });
  });

  it('maps audio call_type to audio and everything else to video', () => {
    expect(inviteFromPayload({ kind: 'call_invite', call_type: 'audio' }).callType).toBe('audio');
    expect(inviteFromPayload({ kind: 'call_invite', call_type: 'screen' }).callType).toBe('video');
  });

  it('returns null for non-invite payloads', () => {
    expect(inviteFromPayload({ kind: 'other' })).toBeNull();
    expect(inviteFromPayload(null)).toBeNull();
  });
});

describe('shouldDeliverInvite', () => {
  it('delivers when the receiver matches the signed-in user', () => {
    expect(shouldDeliverInvite({ senderId: 's1', receiverId: 'r1' }, 'r1')).toBe(true);
  });

  it('discards invites addressed to a different user', () => {
    expect(shouldDeliverInvite({ senderId: 's1', receiverId: 'r1' }, 'r2')).toBe(false);
  });

  it('accepts legacy payloads without a receiver', () => {
    expect(shouldDeliverInvite({ senderId: 's1', receiverId: null }, 'r1')).toBe(true);
  });

  it('discards invites with no sender', () => {
    expect(shouldDeliverInvite({ senderId: null, receiverId: 'r1' }, 'r1')).toBe(false);
    expect(shouldDeliverInvite(null, 'r1')).toBe(false);
  });
});
