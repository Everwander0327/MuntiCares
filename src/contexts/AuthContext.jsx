import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { clearPushToken } from '@/lib/pushNotifications';
import { buildAuthUser } from './authProfile';
import { buildAuthRedirect } from '@/lib/authRedirect';

const defaultAuthValue = {
  user: null,
  authInitialized: false,
  login: async () => {},
  register: async () => {},
  setPassword: async () => {},
  logout: () => {},
  updateUser: () => {},
};

const AuthContext = createContext(defaultAuthValue);

export const useAuth = () => useContext(AuthContext) || defaultAuthValue;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const sessionRef = useRef(null);

  const fetchUserProfile = useCallback(async (authUser) => {
    if (!authUser?.id) return null;
    try {
      const { data: profile, error } = await supabase
        .from('users')
        .select('id, email, full_name, role, avatar_url, is_banned')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        console.warn('[auth] Failed to fetch user profile:', error.message);
        // Keep role unknown so ProtectedRoute/AuthPage show a spinner instead of
        // redirecting a provider into the patient dashboard on a transient outage.
        return buildAuthUser(authUser, null, true);
      }

      if (profile?.is_banned) {
        await supabase?.auth?.signOut?.();
        return null;
      }

      // The auth identity survives an admin "permanent delete" that only removed the
      // public.users row. Fail closed: sign out rather than synthesizing a patient.
      if (!profile) {
        console.warn('[auth] No user profile found; signing out.');
        await supabase?.auth?.signOut?.();
        return null;
      }

      // Role comes from the database only. auth.users.user_metadata is writable by
      // the account owner through supabase.auth.updateUser(), so trusting it lets
      // anyone grant themselves provider or admin UI.
      return buildAuthUser(authUser, profile);
    } catch (e) {
      console.warn('[auth] Exception fetching profile:', e);
      return buildAuthUser(authUser, null, true);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Use onAuthStateChange as the single source of truth for session lifecycle.
    // Defer any database queries with setTimeout(..., 0) to avoid Supabase GoTrue lock deadlocks.
    let subscription = null;
    if (supabase?.auth?.onAuthStateChange) {
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (!isMounted) return;

        sessionRef.current = session;

        if (session?.user) {
          // Render continuity while the profile query runs. The role stays unknown
          // until public.users confirms it — user_metadata.role is client-writable.
          const quickUser = {
            id: session.user.id,
            email: session.user.email,
            role: null,
            full_name: session.user.user_metadata?.full_name || '',
            avatar_url: session.user.user_metadata?.avatar_url || '',
            is_banned: false,
          };
          setUser((prev) => prev || quickUser);
          setAuthInitialized(true);

          const sessionAtFetch = session;
          setTimeout(async () => {
            if (!isMounted) return;
            // The session may have changed (sign-out / different account) while the
            // profile query was in flight. Dropping the stale result prevents a
            // previous user's profile from being committed over the current session.
            if (sessionRef.current?.user?.id !== sessionAtFetch.user.id) return;
            const profile = await fetchUserProfile(session.user);
            if (!isMounted) return;
            if (sessionRef.current?.user?.id !== sessionAtFetch.user.id) return;
            // null means the account is banned and has just been signed out.
            setUser(profile || null);
          }, 0);
        } else {
          setUser(null);
          setAuthInitialized(true);
        }
      });
      subscription = authListener?.subscription;
    } else {
      setAuthInitialized(true);
    }

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
    };
  }, [fetchUserProfile]);

  const login = useCallback(async ({ email, password }) => {
    if (!supabase?.auth?.signInWithPassword) {
      throw new Error('Supabase Auth is not available');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password');
      }
      if (error.message.toLowerCase().includes('email not confirmed')) {
        throw new Error('Confirm your email address first — open the link we sent to your inbox.');
      }
      throw new Error(error.message);
    }

    const profile = await fetchUserProfile(data.user);
    if (!profile) {
      throw new Error('This account is no longer available.');
    }
    setUser(profile);
    return profile;
  }, [fetchUserProfile]);

  const register = useCallback(async ({ email, password, fullName, role, privacyAcceptedAt }) => {
    if (!supabase?.auth?.signUp) {
      throw new Error('Supabase Auth is not available');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: buildAuthRedirect('/login'),
        data: {
          full_name: fullName,
          role: role || 'patient',
          privacy_accepted_at: privacyAcceptedAt || null,
        },
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new Error('An account with this email address already exists. Please sign in instead.');
      }
      throw new Error(error.message);
    }

    // With email confirmation enabled Supabase returns a user with no identities for an
    // address that is already registered instead of an error, to avoid leaking which
    // addresses exist. The caller shows "check your email" for both cases.
    return {
      user: data.user,
      needsConfirmation: !data.session,
    };
  }, []);

  const setPassword = useCallback(async ({ password }) => {
    if (!supabase?.auth?.updateUser) {
      throw new Error('Supabase Auth is not available');
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }, []);

  const logout = useCallback(async () => {
    // Drop this device from the push registry while the session can still authorise it,
    // otherwise a signed-out handset keeps ringing for someone else's consultations.
    await clearPushToken();
    setUser(null);
    // Onboarding drafts hold contact details and medical notes; they must not
    // survive on a shared device after sign-out.
    try {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith('mc_onboarding_draft'))
        .forEach((key) => window.localStorage.removeItem(key));
    } catch (err) {
      console.warn('[auth] Could not clear onboarding drafts:', err);
    }
    try {
      await supabase?.auth?.signOut?.();
    } catch (err) {
      console.warn('[auth] Error signing out:', err);
    }
  }, []);

  const updateUser = useCallback((updates) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      return updated;
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('munticares-user-updated'));
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, setPassword, logout, updateUser, authInitialized }}>
      {children}
    </AuthContext.Provider>
  );
};
