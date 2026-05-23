import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { sha256Hex } from '../../lib/hash';
import { toast } from 'react-hot-toast';
import useFormValidation from '../../hooks/useFormValidation';

const LoginPage = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const form = useFormValidation([
    { name: 'email', rules: ['required', 'email'] },
    { name: 'password', rules: ['required', (v) => v.length >= 6 || 'At least 6 characters'] },
  ]);

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      if (user.role === 'patient') navigate('/patient/dashboard');
      else if (user.role === 'provider') navigate('/provider/dashboard');
      else if (user.role === 'admin') navigate('/admin/dashboard');
      else navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.validateAll()) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    const { email, password } = form.values;

    try {
      setLoading(true);

      // Hash entered password to compare with stored hash
      const enteredHash = await sha256Hex(password);

      const { data, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (queryError) {
        throw new Error('Invalid email or password');
      }

      if (data && (data.password === enteredHash || data.password === password)) {
        if (data.is_banned) {
          throw new Error('Your account has been banned. Please contact support.');
        }
        // If the stored password matched plaintext (legacy), migrate it to hashed form
        if (data.password === password) {
          try {
            const newHash = await sha256Hex(password);
            await supabase.from('users').update({ password: newHash }).eq('id', data.id);
            data.password = newHash; // update the local object
          } catch (e) {
            // migration failure shouldn't block login; log and continue
            console.error('Password migration failed:', e);
          }
        }

        // Successful login
        login(data);
        toast.success('Logged in successfully');
        
        // Redirect based on role
        if (data.role === 'patient') navigate('/patient/dashboard');
        else if (data.role === 'provider') navigate('/provider/dashboard');
        else if (data.role === 'admin') navigate('/admin/dashboard');
        else navigate('/');
      } else {
        throw new Error('Invalid email or password');
      }
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 pt-32 pb-20 relative overflow-hidden">
      {/* Animated floating blobs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl blob-1 pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl blob-2 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/5 rounded-full blur-3xl blob-3 pointer-events-none" />

      <motion.div 
        className={`relative z-10 w-full max-w-md rounded-[2.5rem] p-8 md:p-10 border border-white/50 ${shake ? 'animate-shake' : ''}`}
        style={{
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(30, 111, 191, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.5)',
        }}
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 group mb-6">
            <div className="bg-primary p-2 rounded-lg group-hover:rotate-12 transition-transform shadow-lg shadow-primary/20">
              <Heart className="text-white w-6 h-6" fill="currentColor" />
            </div>
            <span className="text-2xl font-bold text-primary tracking-tight">MuntiCares</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Welcome Back</h1>
          <p className="text-slate-500 mt-2">Login to manage your home care</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="email" 
                placeholder="juan.delacruz@example.com"
                value={form.values.email}
                onChange={(e) => form.handleChange('email', e.target.value)}
                onBlur={() => form.handleBlur('email')}
                className={`w-full bg-white/70 border rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${form.errors.email && form.touched.email ? 'border-red-300' : 'border-slate-200'}`}
              />
              {form.errors.email && form.touched.email && (
                <p className="text-xs text-red-500 mt-1 ml-1">{form.errors.email}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.values.password}
                onChange={(e) => form.handleChange('password', e.target.value)}
                onBlur={() => form.handleBlur('password')}
                className={`w-full bg-white/70 border rounded-2xl py-4 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${form.errors.password && form.touched.password ? 'border-red-300' : 'border-slate-200'}`}
              />
              {form.errors.password && form.touched.password && (
                <p className="text-xs text-red-500 mt-1 ml-1">{form.errors.password}</p>
              )}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-500 p-4 rounded-xl text-sm font-medium text-center">
              {error}
            </div>
          )}

          <motion.button 
            type="submit" 
            disabled={loading}
            className={`btn-primary w-full py-4 text-lg shadow-lg shadow-primary/30 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            whileHover={!loading ? { scale: 1.02 } : {}}
            whileTap={!loading ? { scale: 0.97 } : {}}
          >
            {loading ? 'Logging in...' : 'Login'}
          </motion.button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-500">
            Don't have an account? <Link to="/register" className="text-primary font-bold hover:underline">Register</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
