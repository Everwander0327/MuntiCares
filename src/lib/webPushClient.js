export function decodeApplicationKey(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
}

// Dependency injection keeps permission, account-switch and offline logout paths testable.
export function createWebPushClient(env) {
  async function detach() {
    // Clear the worker first: queued messages must not appear after sign-out.
    await env.setOwner(null);
    const registration = await env.registration();
    const subscription = await registration.pushManager.getSubscription();
    for (const notification of await registration.getNotifications()) notification.close();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    const removed = await subscription.unsubscribe();
    if (!removed) throw new Error('Could not disable browser notifications. Please retry.');
    try { await env.api({ action: 'unsubscribe', endpoint }); } catch { /* invalidated at the browser */ }
  }

  return {
    async enable(userId) {
      if (!userId) throw new Error('Sign in to enable notifications.');
      if (!env.supported()) throw new Error('Browser push is unavailable. On iPhone or iPad, add MuntiCares to your Home Screen and open it there.');
      // Called before the first async operation to preserve the user's click gesture.
      const permission = await env.requestPermission();
      if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser site settings.');
      return env.lock(async () => {
        if (env.getOwner() && env.getOwner() !== userId) await detach();
        const { publicKey } = await env.api({ action: 'config' }, userId);
        if (!publicKey) throw new Error('Push notifications are not configured yet.');
        const registration = await env.registration();
        let subscription = await registration.pushManager.getSubscription();
        try {
          subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeApplicationKey(publicKey) });
          await env.api({ action: 'subscribe', subscription: subscription.toJSON() }, userId);
          await env.setOwner(userId);
        } catch (error) {
          await env.setOwner(null);
          await subscription?.unsubscribe().catch(() => {});
          throw error;
        }
      });
    },
    async disable() {
      if (!env.supported()) return;
      return env.lock(detach);
    },
    async sync(userId) {
      if (!env.supported()) return;
      return env.lock(async () => {
        if (env.getOwner() && env.getOwner() !== userId) { await detach(); return; }
        if (!userId || env.permission() !== 'granted' || env.getOwner() !== userId) return;
        const registration = await env.registration();
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await env.api({ action: 'subscribe', subscription: subscription.toJSON() }, userId);
          await env.setOwner(userId);
        }
      });
    },
  };
}
