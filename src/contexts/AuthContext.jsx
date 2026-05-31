import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useUser, useAuth as useClerkAuth, useClerk, useSignIn } from '@clerk/clerk-react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { isSignedIn } = useClerkAuth();
  const clerk = useClerk();
  const { signIn, setActive } = useSignIn();
  const [user, setUser] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Sync Clerk user -> app user object
  useEffect(() => {
    if (!userLoaded) return;

    if (!isSignedIn || !clerkUser) {
      setUser(null);
      setAuthInitialized(true);
      return;
    }

    setUser({
      id: clerkUser.publicMetadata?.legacy_id || clerkUser.id,
      clerkId: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      role: clerkUser.publicMetadata?.role || 'patient',
      full_name: clerkUser.fullName || '',
      is_banned: clerkUser.publicMetadata?.is_banned || false,
      avatar_url: clerkUser.imageUrl || '',
    });
    setAuthInitialized(true);
  }, [clerkUser, userLoaded, isSignedIn]);

  const login = useCallback(async ({ email, password }) => {
    try {
      const result = await signIn.create({ identifier: email, password });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        return { success: true };
      }

      return { success: false, error: 'Verification required' };
    } catch (err) {
      const message = err.errors?.[0]?.longMessage || err.message || 'Login failed';
      throw new Error(message);
    }
  }, [signIn, setActive]);

  const logout = useCallback(() => {
    clerk.signOut();
  }, [clerk]);

  return (
    <AuthContext.Provider value={{ user, login, logout, authInitialized }}>
      {children}
    </AuthContext.Provider>
  );
};
