import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { IMAGES } from '@/lib/images';
const heroImage = IMAGES.brand.heroAuth;
import { Stethoscope, ArrowUpRight } from '@phosphor-icons/react';
import { Mail, Lock, User, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import confetti from 'canvas-confetti';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { FormInput, FormCheckbox } from '@/shared/ui';



gsap.registerPlugin(ScrollTrigger, useGSAP);

const FLUID = [0.32, 0.72, 0, 1];

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'At least 6 characters'),
});

const registerSchema = z.object({
  fullName: z.string().min(2, 'Enter your full name').regex(/^[a-zA-Z\s'-]+$/, 'Letters only'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'At least 6 characters'),
  confirmPassword: z.string(),
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

const _TabButton = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`relative px-4 md:px-8 py-1.5 md:py-3 text-sm md:text-lg font-semibold transition-all duration-700 ease-fluid ${active ? 'text-link' : 'text-slate-700 dark:text-tertiary hover:text-slate-900 dark:hover:text-slate-300'
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

const PasswordToggle = ({ show, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className="-mr-2 flex h-11 w-11 items-center justify-center rounded-xl text-tertiary transition-colors hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
    tabIndex={-1}
    aria-label={show ? 'Hide password' : 'Show password'}
  >
    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
  </button>
);

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const redirectTarget = searchParams.get('redirect') || location.state?.from?.pathname;
  const roleParam = searchParams.get('role');

  const { user, login, register, setPassword } = useAuth();
  const [mode, setMode] = useState(location.pathname === '/register' ? 'register' : 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState(roleParam === 'provider' ? 'provider' : 'patient');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingSetPassword, setPendingSetPassword] = useState(null);
  const pageRef = useRef(null);
  const bgRef = useRef(null);

  const loginForm = useForm({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm({ resolver: zodResolver(registerSchema) });
  const setPasswordForm = useForm({ resolver: zodResolver(loginSchema) });
  const watchPassword = registerForm.watch('password', '');

  useEffect(() => {
    setMode(location.pathname === '/register' ? 'register' : 'login');
    const nextRole = new URLSearchParams(location.search).get('role');
    if (nextRole === 'provider' || nextRole === 'patient') {
      setRole(nextRole);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (user) {
      if (redirectTarget && (user.role === 'patient' || !redirectTarget.startsWith('/patient') || user.role === 'admin')) {
        navigate(redirectTarget, { replace: true });
        return;
      }
      if (user.role === 'patient') navigate('/patient/dashboard');
      else if (user.role === 'provider') navigate('/provider/dashboard');
      else if (user.role === 'admin') navigate('/admin/dashboard');
      else navigate('/');
    }
  }, [user, navigate, redirectTarget]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mode === 'login') {
        loginForm.setFocus('email');
      } else if (mode === 'register') {
        registerForm.setFocus('fullName');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [mode]);

  useGSAP(
    () => {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const ctx = gsap.context(() => {
        gsap.fromTo(
          bgRef.current,
          { scale: isMobile ? 1.0 : 1.05, opacity: 0.7 },
          {
            scale: 1.0,
            opacity: 1,
            duration: isMobile ? 0.8 : 1.4,
            ease: 'power2.out',
          }
        );
      }, pageRef);
      return () => ctx.revert();
    },
    { scope: pageRef }
  );

  const handleLogin = async (data) => {
    setError('');
    setLoading(true);
    try {
      await login({ email: data.email, password: data.password });
      toast.success('Logged in successfully');
    } catch (err) {
      if (err.message === 'SET_PASSWORD') {
        setPendingSetPassword(data.email);
        setError('');
        setLoading(false);
        return;
      }
      const message = err.message || 'Invalid email or password';
      setError(message);
      toast.error(message);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (data) => {
    setError('');
    setLoading(true);
    try {
      await setPassword({ email: pendingSetPassword, password: data.password });
      toast.success('Password set! You can now sign in.');
      setPendingSetPassword(null);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (data) => {
    setError('');
    setLoading(true);
    try {
      await register({ email: data.email, password: data.password, fullName: data.fullName, role });
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      toast.success('Account created! You can now sign in.');
      setMode('login');
      setError('');
    } catch (err) {
      const message = err.message || 'Registration failed';
      setError(message);
      toast.error(message);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength(watchPassword);

  const formContent = (isLogin) => {
    if (pendingSetPassword) {
      return (
        <motion.div
          key="set-password"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.5, ease: FLUID }}
        >
          <div className="text-center mb-6">
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Set Your Password</h3>
            <p className="text-sm text-tertiary dark:text-tertiary mt-1">
              First-time login for<br />
              <span className="font-semibold text-slate-700 dark:text-slate-300">{pendingSetPassword}</span>
            </p>
          </div>
          <form className="space-y-2" onSubmit={setPasswordForm.handleSubmit(handleSetPassword)}>
            <FormInput
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              icon={Lock}
              className="!py-2.5"
              error={setPasswordForm.formState.errors.password?.message}
              rightElement={<PasswordToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
              {...setPasswordForm.register('password')}
            />
            {error && (
              <div className="bg-danger/10 text-danger dark:text-danger-dark p-3 rounded-[1.25rem] text-xs font-medium text-center ring-1 ring-red-500/20">{error}</div>
            )}
            <motion.button
              type="submit"
              disabled={loading}
              className={`neu-btn-primary w-full py-3.5 rounded-2xl text-xs sm:text-sm font-bold shadow-md cursor-pointer ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              whileHover={!loading ? { scale: 1.01 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
            >
              {loading ? 'Setting password...' : 'Set Password'}
            </motion.button>
            <button
              type="button"
              onClick={() => { setPendingSetPassword(null); setError(''); }}
              className="w-full text-xs text-tertiary hover:text-slate-600 font-medium transition-colors"
            >
              Use a different account
            </button>
          </form>
        </motion.div>
      );
    }

    if (isLogin) {
      return (
        <motion.div
          key="login"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.35, ease: FLUID }}
        >
          <form className="space-y-4" onSubmit={loginForm.handleSubmit(handleLogin)}>
            <FormInput
              label="Email Address"
              type="email"
              autoComplete="email"
              placeholder="juan.delacruz@example.com"
              icon={Mail}
              className="!py-2.5"
              error={loginForm.formState.errors.email?.message}
              {...loginForm.register('email')}
            />

            <FormInput
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              icon={Lock}
              className="!py-2.5"
              error={loginForm.formState.errors.password?.message}
              rightElement={<PasswordToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
              {...loginForm.register('password')}
            />

            <div className="flex items-center justify-between">
              <FormCheckbox label="Remember me" labelClassName="text-slate-900 dark:text-slate-100" {...loginForm.register('remember')} />
              <button
                type="button"
                onClick={() => toast('Password reset coming soon')}
                className="text-xs text-link font-bold hover:underline transition-all cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            {error && (
              <div className="bg-danger/10 text-danger dark:text-danger-dark p-3 rounded-[1.25rem] text-xs font-medium text-center ring-1 ring-red-500/20">
                {error}
              </div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              className={`neu-btn-primary w-full py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-md cursor-pointer ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              whileHover={!loading ? { scale: 1.01 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
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
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{ duration: 0.35, ease: FLUID }}
      >
        <form className="space-y-3" onSubmit={registerForm.handleSubmit(handleRegister)}>
          {/* Role Pills */}
          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 ml-1 block mb-1.5">I am a...</label>
            <div className="flex gap-2">
              {[
                { value: 'patient', label: 'Patient', icon: <User size={15} weight="light" /> },
                { value: 'provider', label: 'Provider', icon: <Stethoscope size={15} weight="light" /> },
              ].map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`flex-1 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.98] cursor-pointer ${role === r.value
                      ? 'neu-btn-primary shadow-sm'
                      : 'neu-btn text-slate-700 dark:text-slate-300'
                    }`}
                >
                  {r.icon}
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <FormInput
                label="Full Name"
                autoComplete="name"
                placeholder="Juan Dela Cruz"
                icon={User}
                className="!py-2"
                error={registerForm.formState.errors.fullName?.message}
                {...registerForm.register('fullName')}
              />
              <FormInput
                label="Email Address"
                type="email"
                autoComplete="email"
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
                autoComplete="new-password"
                placeholder="••••••••"
                icon={Lock}
                className="!py-2"
                error={registerForm.formState.errors.password?.message}
                rightElement={<PasswordToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
                {...registerForm.register('password')}
              />
              <FormInput
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                icon={ShieldCheck}
                className="!py-2"
                error={registerForm.formState.errors.confirmPassword?.message}
                rightElement={<PasswordToggle show={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} />}
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
                    className={`h-1 flex-1 rounded-full transition-all duration-700 ease-fluid ${i <= strength ? strengthColors[strength] : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                  />
                ))}
              </div>
              <p className={`text-xs font-medium text-right mt-1 ${strength <= 2 ? 'text-red-400' : strength <= 3 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                {strengthLabels[strength]}
              </p>
            </div>
          )}



          {error && (
            <div className="bg-danger/10 text-danger dark:text-danger-dark p-3 rounded-[1.25rem] text-sm font-medium text-center ring-1 ring-red-500/20">
              {error}
            </div>
          )}

          <motion.button
            type="submit"
            disabled={loading}
            className={`neu-btn-primary w-full py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-md cursor-pointer ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            whileHover={!loading ? { scale: 1.01 } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </motion.button>
        </form>
      </motion.div>
    );
  };

  return (
    <main ref={pageRef} className="relative min-h-[100dvh] overflow-x-hidden w-full max-w-full flex items-center justify-center bg-secondary text-slate-900 dark:bg-slate-950 dark:text-white pt-24 sm:pt-28 pb-8 px-3 sm:px-6">
      {/* Theme-aware cinema backdrop */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div ref={bgRef} className="h-full w-full">
          <img
            src={heroImage}
            alt=""
            className="h-full w-full object-cover opacity-45 saturate-110 dark:opacity-60"
            loading="eager"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-secondary/60 via-white/55 to-secondary/85 dark:from-slate-950/80 dark:via-slate-950/75 dark:to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(30,111,191,0.08)_78%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.6)_78%)]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-sm sm:max-w-md my-auto">
        <div className="text-center mb-3 sm:mb-5">
          <h1 className="font-display font-black text-slate-900 dark:text-white w-full tracking-tight text-xl sm:text-2xl md:text-3xl">
            {mode === 'login' ? 'Welcome back' : 'Create an Account'}
          </h1>
          <p className="mt-0.5 sm:mt-1 text-sm font-medium text-tertiary dark:text-tertiary">
            {mode === 'login' ? 'Sign in to access your healthcare portal.' : 'Register to connect with verified home care.'}
          </p>
        </div>

        <motion.div
          className={`relative w-full transform-gpu ${shake ? 'animate-shake' : ''}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: FLUID }}
        >
          <div className="neu-flat rounded-2xl sm:rounded-[2.25rem] p-4 sm:p-6 md:p-8">
            {!pendingSetPassword && (
              <div className="flex neu-inset rounded-xl sm:rounded-2xl mb-4 sm:mb-5 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); }}
                  className={`flex-1 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer select-none ${mode === 'login'
                      ? 'neu-flat text-link font-black shadow-sm'
                      : 'text-tertiary dark:text-tertiary hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(''); }}
                  className={`flex-1 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer select-none ${mode === 'register'
                      ? 'neu-flat text-link font-black shadow-sm'
                      : 'text-tertiary dark:text-tertiary hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  Register
                </button>
              </div>
            )}

            <AnimatePresence mode="wait">
              {formContent(mode === 'login')}
            </AnimatePresence>

            {!pendingSetPassword && mode === 'login' && (
              <div className="pt-4">
                <Link to="/register" className="group flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold text-link hover:text-primary-700 transition-colors">
                  New here? Create an account
                  <ArrowUpRight size={14} weight="bold" className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </main>
  );
};

export default AuthPage;
