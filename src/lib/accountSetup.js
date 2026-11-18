export const needsAccountSetup = (user) => user?.setup_pending === true;
export async function verifySignupCode(auth, email, code) {
  if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code from your email.');
  const { error } = await auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw new Error('Invalid or expired code. Please retry or request a new code.');
}
export async function setupAction(client, action, values = {}) {
  const { data, error } = await client.functions.invoke('account-setup', { body: { action, ...values } });
  if (error) {
    let message = 'Unable to complete setup. Please retry.';
    try { message = (await error.context.json()).error || message; } catch { /* no JSON response */ }
    throw new Error(message);
  }
  if (!data?.ok) throw new Error(data?.error || 'Setup could not be completed.');
}
