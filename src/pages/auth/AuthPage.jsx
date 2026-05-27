 
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import heroImage from '../../assets/hero.png';
import { Heart, Mail, Lock, User, UserCheck, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import confetti from 'canvas-confetti';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { sha256Hex } from '../../lib/hash';
import { toast } from 'react-hot-toast';
import { FormInput, FormCheckbox } from '../../components/ui/form-input';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'At least 6 characters'),
});

const registerSchema = z.object({
  fullName: z.string().min(2, 'Enter your full name').regex(/^[a-zA-Z\s'-]+$/, 'Letters only'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'At least 6 characters'),
  confirmPassword: z.string(),
  terms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const getPasswordStrength = (password) => {
  let score = 0;
  if (!password) return 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
};

const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
const strengthColors = ['', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-400', 'bg-green-400'];

const TabButton = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`relative px-4 md:px-8 py-1.5 md:py-3 text-sm md:text-lg font-semibold transition-colors ${
      active ? 'text-primary' : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
    }`}
  >
    {label}
    {active && (
      <motion.div
        layoutId="tab-indicator"
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />
    )}
  </button>
);

const AuthPage = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [mode, setMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState('patient');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef(null);

  const loginForm = useForm({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm({ resolver: zodResolver(registerSchema) });
  const watchPassword = registerForm.watch('password', '');

  useEffect(() => {
    if (user) {
      if (user.role === 'patient') navigate('/patient/dashboard');
      else if (user.role === 'provider') navigate('/provider/dashboard');
      else if (user.role === 'admin') navigate('/admin/dashboard');
      else navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => emailRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, [mode]);

  const handleLogin = async (data) => {
    setError('');
    setLoading(true);
    try {
      const enteredHash = await sha256Hex(data.password);
      const { data: result, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('email', data.email)
        .single();

      if (queryError) throw new Error('Invalid email or password');

      if (result && (result.password === enteredHash || result.password === data.password)) {
        if (result.is_banned) throw new Error('Your account has been banned. Please contact support.');
        if (result.password === data.password) {
          try {
            const newHash = await sha256Hex(data.password);
            await supabase.from('users').update({ password: newHash }).eq('id', result.id);
          } catch (e) { console.error('Password migration failed:', e); }
        }
        login(result);
        toast.success('Logged in successfully');
        const rolePath = result.role === 'admin' ? '/admin/dashboard' : `/${result.role}/dashboard`;
        navigate(rolePath);
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

  const handleRegister = async (data) => {
    setError('');
    setLoading(true);
    try {
      const hashed = await sha256Hex(data.password);
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{ full_name: data.fullName, email: data.email, password: hashed, role }])
        .select();

      if (insertError) throw insertError;

      if (role === 'provider' && newUser?.[0]) {
        const { error: providerError } = await supabase
          .from('providers')
          .insert([{ user_id: newUser[0].id }]);
        if (providerError) console.error('Error creating provider profile:', providerError);
      }

      if (newUser?.[0]) {
        login(newUser[0]);
        toast.success('Account created');
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      }

      navigate(role === 'patient' ? '/patient/dashboard' : '/provider/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'An error occurred during registration');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength(watchPassword);

  const formContent = (isLogin) => {
    if (isLogin) {
      return (
          <motion.div
            key="login"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25 }}
          >
            <form className="space-y-2" onSubmit={loginForm.handleSubmit(handleLogin)}>
                  <FormInput
                    label="Email Address"
                    type="email"
                    placeholder="juan.delacruz@example.com"
                    icon={Mail}
                    className="!py-2.5"
                    error={loginForm.formState.errors.email?.message}
                    ref={emailRef}
                    {...loginForm.register('email')}
                  />

                  <FormInput
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    icon={Lock}
                    className="!py-2.5"
                    error={loginForm.formState.errors.password?.message}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              }
              {...loginForm.register('password')}
            />

            <div className="flex items-center justify-between">
              <FormCheckbox label="Remember me" labelClassName="text-slate-900 dark:text-slate-100" {...loginForm.register('remember')} />
              <button
                type="button"
                onClick={() => toast.info('Password reset coming soon')}
                className="text-xs text-red-800 font-semibold hover:text-red-900 transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-300 p-3 rounded-xl text-xs font-medium text-center">
                  {error}
                </div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
            className={`btn-primary w-full py-3 text-sm shadow-lg shadow-primary/30 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              whileHover={!loading ? { scale: 1.02 } : {}}
              whileTap={!loading ? { scale: 0.97 } : {}}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </motion.button>
          </form>
        </motion.div>
      );
    }

    return (
      <motion.div
        key="register"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.25 }}
      >
        <form className="space-y-2" onSubmit={registerForm.handleSubmit(handleRegister)}>
          {/* Role Pills */}
          <div>
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 ml-1 block mb-1.5">I am a...</label>
            <div className="flex gap-2">
              {['patient', 'provider'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all border-2 ${
                    role === r
                      ? 'border-primary bg-primary text-white shadow-md shadow-primary/20'
                      : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 hover:border-slate-400 dark:hover:border-slate-500'
                  }`}
                >
                  {r === 'patient' ? '🧑‍⚕️ Patient' : '👨‍⚕️ Provider'}
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <FormInput
                label="Full Name"
                placeholder="Juan Dela Cruz"
                icon={User}
                className="!py-2"
                error={registerForm.formState.errors.fullName?.message}
                {...registerForm.register('fullName')}
              />
              <FormInput
                label="Email Address"
                type="email"
                placeholder="juan@example.com"
                icon={Mail}
                className="!py-2"
                error={registerForm.formState.errors.email?.message}
                {...registerForm.register('email')}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <FormInput
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                icon={Lock}
                className="!py-2"
                error={registerForm.formState.errors.password?.message}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
                {...registerForm.register('password')}
              />
              <FormInput
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                icon={UserCheck}
                className="!py-2"
                error={registerForm.formState.errors.confirmPassword?.message}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
                {...registerForm.register('confirmPassword')}
              />
            </div>
          </div>

          {watchPassword && (
            <div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= strength ? strengthColors[strength] : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
              <p className={`text-[11px] font-medium text-right mt-0.5 ${
                strength <= 2 ? 'text-red-400' : strength <= 3 ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {strengthLabels[strength]}
              </p>
            </div>
          )}

          <FormCheckbox
            label="I accept the Terms &amp; Conditions"
            labelClassName="text-slate-900 dark:text-slate-100"
            error={registerForm.formState.errors.terms?.message}
            {...registerForm.register('terms')}
          />

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-300 p-3 rounded-xl text-sm font-medium text-center">
              {error}
            </div>
          )}

          <motion.button
            type="submit"
            disabled={loading}
            className={`btn-primary w-full py-3 text-sm shadow-lg shadow-primary/30 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            whileHover={!loading ? { scale: 1.02 } : {}}
            whileTap={!loading ? { scale: 0.97 } : {}}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </motion.button>
        </form>
      </motion.div>
    );
  };

  return (
    <div className="flex h-screen">
      {/* Brand Side - hidden on mobile */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-blue-600 to-indigo-900">
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-40"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-primary/20 to-transparent" />

        <div className="relative z-10 flex flex-col items-center justify-center text-white px-16 py-20 w-full h-full">
          <Link to="/" className="inline-flex items-center gap-3 mb-10">
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
              <Heart className="w-8 h-8 text-white" fill="currentColor" />
            </div>
            <span className="text-3xl font-bold tracking-tight">MuntiCares</span>
          </Link>

          <h2 className="text-4xl font-bold leading-tight mb-4 text-center">Your Health,<br />Our Priority</h2>
          <p className="text-white/70 text-lg mb-12 text-center max-w-sm">Muntinlupa&apos;s trusted home care platform connecting families with professional caregivers.</p>

          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold">10K+</p>
              <p className="text-sm text-white/70 mt-1">Patients</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold">500+</p>
              <p className="text-sm text-white/70 mt-1">Providers</p>
            </div>
          </div>

          <div className="mt-12 bg-white/10 backdrop-blur-sm rounded-2xl p-6 max-w-sm">
            <p className="text-lg italic leading-relaxed text-white/90">&quot;MuntiCares gave my mother the care she deserves. The caregivers are professional and very compassionate.&quot;</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">M</div>
              <div>
                <p className="font-semibold text-sm">Maria Santos</p>
                <p className="text-xs text-white/60">Patient&apos;s Daughter</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Side */}
      <div className="w-full lg:w-1/2 relative flex items-center justify-center pt-20 lg:pt-0 p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 overflow-hidden">
        {/* Mobile hero background */}
        <div className="lg:hidden absolute inset-0">
          <img
            src={heroImage}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-blue-700/70 to-indigo-900/80" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
        </div>

        <motion.div
          className={`relative w-full max-w-md lg:max-w-lg ${shake ? 'animate-shake' : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* Mobile brand mini */}
          <div className="lg:hidden text-center mb-4">
            <Link to="/" className="inline-flex items-center gap-2 mb-2">
              <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20">
                <Heart className="text-white w-5 h-5" fill="currentColor" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">MuntiCares</span>
            </Link>
            <p className="text-white/60 text-xs">Your Health, Our Priority</p>
          </div>

          {/* Glass Card */}
          <div
            className="bg-white/30 md:bg-white/50 dark:bg-slate-900/30 dark:md:bg-slate-900/50 rounded-xl md:rounded-[2.5rem] p-3 md:p-10 border border-white/40 dark:border-slate-700"
            style={{
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              boxShadow: '0 8px 32px rgba(30, 111, 191, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.5)',
            }}
          >
            {/* Tabs */}
            <div className="flex justify-center border-b border-slate-200 dark:border-slate-700 mb-3">
              <TabButton active={mode === 'login'} label="Login" onClick={() => { setMode('login'); setError(''); }} />
              <TabButton active={mode === 'register'} label="Register" onClick={() => { setMode('register'); setError(''); }} />
            </div>

            <AnimatePresence mode="wait">
              {formContent(mode === 'login')}
            </AnimatePresence>

          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
