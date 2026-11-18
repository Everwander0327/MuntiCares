export async function startGoogleSignIn(auth, { accepted, origin }) {
  if (!accepted) throw new Error('Please accept the privacy notice to continue with Google.');
  const { error } = await auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin.replace(/\/$/, '')}/login`,
      scopes: 'openid email profile',
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw new Error(error.message);
}
export function googleCallbackError(search, hash) {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const error = query.get('error') || fragment.get('error');
  if (!error) return '';
  return error === 'access_denied' ? 'Google sign-in was cancelled. Please try again.' : 'Google sign-in could not be completed. Please try again or use email and password.';
}
