import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('munticares_user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  // authInitialized indicates we've finished validating/refreshing the cached user
  const [authInitialized, setAuthInitialized] = useState(false);

  const login = (userData) => {
    const normalized = {
      id: userData.id,
      email: userData.email,
      role: userData.role,
      full_name: userData.full_name || userData.fullName || userData.name || '',
      is_banned: userData.is_banned || false,
      // keep any other fields present
      ...userData,
    };
    localStorage.setItem('munticares_user', JSON.stringify(normalized));
    setUser(normalized);
    // Mark auth as initialized when we actively log in to avoid race with initial validation
    setAuthInitialized(true);
  };

  const logout = () => {
    localStorage.removeItem('munticares_user');
    setUser(null);
  };

  // Validate cached user against server profile on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const cached = localStorage.getItem('munticares_user');
        if (!cached) {
          if (mounted) setAuthInitialized(true);
          return;
        }

        const parsed = JSON.parse(cached);
        // Try to refresh from server using id if available, otherwise email
        const identifier = parsed.id ? { id: parsed.id } : { email: parsed.email };
        if (!identifier.id && !identifier.email) {
          if (mounted) setAuthInitialized(true);
          return;
        }

        let res;
        if (identifier.id) {
          res = await supabase.from('users').select('*').eq('id', identifier.id).maybeSingle();
        } else {
          res = await supabase.from('users').select('*').eq('email', identifier.email).maybeSingle();
        }

        const { data } = res || {};
        if (mounted) {
          if (data) {
            // update cache with canonical server data
            const normalized = {
              id: data.id,
              email: data.email,
              role: data.role,
              full_name: data.full_name || data.name || '',
              is_banned: data.is_banned || false,
              ...data,
            };
            localStorage.setItem('munticares_user', JSON.stringify(normalized));
            setUser(normalized);
          } else {
            // server has no record; clear local cache
            localStorage.removeItem('munticares_user');
            setUser(null);
          }
          setAuthInitialized(true);
        }
      } catch (err) {
        // if anything goes wrong, mark initialized so UI can proceed
        if (mounted) setAuthInitialized(true);
      }
    };

    init();

    // cross-tab sync: respond to other tabs logging out/in
    const onStorage = (e) => {
      if (e.key === 'munticares_user') {
        const v = e.newValue;
        setUser(v ? JSON.parse(v) : null);
      }
    };

    window.addEventListener('storage', onStorage);

    return () => {
      mounted = false;
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, authInitialized }}>
      {children}
    </AuthContext.Provider>
  );
};
