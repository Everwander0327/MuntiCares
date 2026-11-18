export const needsAccountSetup = (user) => user?.setup_pending === true;
export async function verifySignupCode(auth, email, code) {
  if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code from your email.');
  const { error } = await auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw new Error('Invalid or expired code. Please retry or request a new code.');
}
export function setupSessionError() {
  return Object.assign(new Error('Your session expired. Sign in again to continue setup.'), { code: 'setup_session_expired' });
}
export async function setupAction(client, action, values = {}) {
  const { data: current, error: sessionError } = await client.auth.getSession();
  if (sessionError || !current?.session) throw setupSessionError();
  const { data, error } = await client.functions.invoke('account-setup', { body: { action, ...values }, headers: { Authorization: `Bearer ${current.session.access_token}` } });
  if (error) {
    if (error.context?.status === 401) throw setupSessionError();
    let message = 'Unable to complete setup. Please retry.';
    try { message = (await error.context.json()).error || message; } catch { /* no JSON response */ }
    throw new Error(message);
  }
  if (!data?.ok) throw new Error(data?.error || 'Setup could not be completed.');
  if (data.session) {
    const { error: replacementError } = await client.auth.setSession(data.session);
    if (replacementError) throw setupSessionError();
  }
}
