import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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
      }

      if (profile?.is_banned) {
        await supabase?.auth?.signOut?.();
        return null;
      }

      return {
        id: authUser.id,
        email: authUser.email,
        role: profile?.role || authUser.user_metadata?.role || 'patient',
        full_name: profile?.full_name || authUser.user_metadata?.full_name || '',
        avatar_url: profile?.avatar_url || authUser.user_metadata?.avatar_url || '',
        is_banned: profile?.is_banned || false,
      };
    } catch (e) {
      console.warn('[auth] Exception fetching profile:', e);
      return {
        id: authUser.id,
        email: authUser.email,
        role: authUser.user_metadata?.role || 'patient',
        full_name: authUser.user_metadata?.full_name || '',
        avatar_url: authUser.user_metadata?.avatar_url || '',
        is_banned: false,
      };
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

        if (session?.user) {
          // Provide instant local metadata so ProtectedRoute doesn't block
          const quickUser = {
            id: session.user.id,
            email: session.user.email,
            role: session.user.user_metadata?.role || 'patient',
            full_name: session.user.user_metadata?.full_name || '',
            avatar_url: session.user.user_metadata?.avatar_url || '',
            is_banned: false,
          };
          setUser((prev) => prev || quickUser);
          setAuthInitialized(true);

          setTimeout(async () => {
            if (!isMounted) return;
            const profile = await fetchUserProfile(session.user);
            if (isMounted && profile) {
              setUser(profile);
            }
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
      throw new Error(error.message);
    }

    const profile = await fetchUserProfile(data.user);
    if (!profile) {
      throw new Error('Account is banned');
    }
    setUser(profile);
    return profile;
  }, [fetchUserProfile]);

  const register = useCallback(async ({ email, password, fullName, role }) => {
    if (!supabase?.auth?.signUp) {
      throw new Error('Supabase Auth is not available');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role || 'patient',
        },
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new Error('An account with this email address already exists. Please sign in instead.');
      }
      throw new Error(error.message);
    }

    return data.user;
  }, []);

  const setPassword = useCallback(async ({ password }) => {
    if (!supabase?.auth?.updateUser) {
      throw new Error('Supabase Auth is not available');
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
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
