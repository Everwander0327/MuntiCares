import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

function hex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  return hex(await crypto.subtle.digest('SHA-256', data));
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('munticares_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('munticares_user');
      }
    }
    setAuthInitialized(true);
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw new Error('Database error');
    if (!data) throw new Error('Account not found');

    if (!data.password) {
      throw new Error('SET_PASSWORD');
    }

    const hash = await hashPassword(password);
    if (hash !== data.password) {
      throw new Error('Invalid email or password');
    }

    if (data.is_banned) {
      throw new Error('Account is banned');
    }

    const userData = {
      id: data.id,
      email: data.email,
      role: data.role,
      full_name: data.full_name,
      is_banned: data.is_banned,
      avatar_url: data.avatar_url || '',
    };

    localStorage.setItem('munticares_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const setPassword = useCallback(async ({ email, password }) => {
    const hash = await hashPassword(password);
    const { error } = await supabase
      .from('users')
      .update({ password: hash })
      .eq('email', email);

    if (error) throw new Error('Failed to set password');
  }, []);

  const register = useCallback(async ({ email, password, fullName, role }) => {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    const hash = await hashPassword(password);

    if (existing) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ full_name: fullName, role, password: hash })
        .eq('id', existing.id);
      if (updateError) throw new Error(updateError.message);
    } else {
      const newId = crypto.randomUUID();
      const { error: insertError } = await supabase.from('users').insert({
        id: newId,
        email,
        full_name: fullName,
        role,
        password: hash,
        is_banned: false,
      });
      if (insertError) throw new Error(insertError.message);

      if (role === 'provider') {
        const { error: provError } = await supabase.from('providers').insert([{ user_id: newId }]);
        if (provError) throw new Error(provError.message);
      }
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('munticares_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, setPassword, logout, authInitialized }}>
      {children}
    </AuthContext.Provider>
  );
};
