import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IMAGES } from '@/lib/images';
import { Eye, EyeOff } from 'lucide-react';
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
  privacyAccepted: z.literal(true, { message: 'Please accept the privacy notice to continue.' }),
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

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '', privacyAccepted: false },
  });

  const setPasswordForm = useForm({
    resolver: zodResolver(z.object({ password: z.string().min(6, 'At least 6 characters') })),
    defaultValues: { password: '' },
  });

  const watchPassword = registerForm.watch('password');

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
        if (bgRef.current) {
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
        }
      }, pageRef);
      return () => ctx.revert();
    },
    { scope: pageRef }
  );

  const handleLogin = async (data) => {
    setError('');
    setLoading(true);
    try {
      const res = await login({ email: data.email, password: data.password });
      if (res?.requiresPasswordSet) {
        setPendingSetPassword(res.email);
        toast('First-time login: please set your password.');
        return;
      }
      toast.success('Signed in successfully!');
      if (redirectTarget) {
        navigate(redirectTarget, { replace: true });
      } else {
        const destRole = res?.user?.role || role;
        if (destRole === 'patient') navigate('/patient/dashboard');
        else if (destRole === 'provider') navigate('/provider/dashboard');
        else if (destRole === 'admin') navigate('/admin/dashboard');
        else navigate('/');
      }
    } catch (err) {
      const message = err.message || 'Login failed';
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
      const result = await register({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        role,
        privacyAcceptedAt: new Date().toISOString(),
      });
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      if (result?.needsConfirmation) {
        toast.success('Account created. Check your email to confirm it, then sign in.');
      } else {
        toast.success('Account created! You can now sign in.');
      }
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
          transition={{ duration: 0.35, ease: FLUID }}
          className="space-y-4"
        >
          <div className="text-center mb-4">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">Set Your Password</h3>
            <p className="text-xs text-tertiary mt-1">
              First-time login for <span className="font-semibold text-slate-700 dark:text-slate-300">{pendingSetPassword}</span>
            </p>
          </div>
          <form className="space-y-3" onSubmit={setPasswordForm.handleSubmit(handleSetPassword)}>
            <FormInput
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              className="!py-2.5"
              error={setPasswordForm.formState.errors.password?.message}
              rightElement={<PasswordToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
              {...setPasswordForm.register('password')}
            />
            {error && (
              <div className="bg-danger/10 text-danger dark:text-danger-dark p-3 rounded-xl text-xs font-medium text-center ring-1 ring-red-500/20">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`neu-btn-primary w-full py-3.5 rounded-xl text-sm font-bold text-white shadow-md cursor-pointer ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Setting password...' : 'Set Password'}
            </button>
            <button
              type="button"
              onClick={() => { setPendingSetPassword(null); setError(''); }}
              className="w-full text-xs text-tertiary hover:text-slate-600 dark:hover:text-slate-300 font-medium transition-colors"
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
              className="!py-2.5"
              error={loginForm.formState.errors.email?.message}
              {...loginForm.register('email')}
            />

            <FormInput
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className="!py-2.5"
              error={loginForm.formState.errors.password?.message}
              rightElement={<PasswordToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
              {...loginForm.register('password')}
            />

            <div className="flex items-center justify-between text-xs">
              <FormCheckbox label="Remember me" labelClassName="text-slate-800 dark:text-slate-200" {...loginForm.register('remember')} />
              <button
                type="button"
                onClick={() => navigate('/reset-password')}
                className="text-xs text-link font-bold hover:underline transition-all cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            {error && (
              <div className="bg-danger/10 text-danger dark:text-danger-dark p-3 rounded-xl text-xs font-medium text-center ring-1 ring-red-500/20">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`neu-btn-primary w-full py-3.5 rounded-xl text-sm font-bold text-white shadow-md cursor-pointer active:scale-[0.99] transition-all ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
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
        <form className="space-y-3.5" onSubmit={registerForm.handleSubmit(handleRegister)}>
          {/* Role Pills (Icon-Free) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 ml-1 block">I am registering as:</label>
            <div className="flex gap-2">
              {[
                { value: 'patient', label: 'Patient' },
                { value: 'provider', label: 'Provider' },
              ].map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    role === r.value
                      ? 'bg-[#2F6FB5] text-white shadow-sm'
                      : 'border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields (Icon-Free) */}
          <div className="space-y-2.5">
            <FormInput
              label="Full Name"
              autoComplete="name"
              placeholder="Juan Dela Cruz"
              className="!py-2"
              error={registerForm.formState.errors.fullName?.message}
              {...registerForm.register('fullName')}
            />
            <FormInput
              label="Email Address"
              type="email"
              autoComplete="email"
              placeholder="juan@example.com"
              className="!py-2"
              error={registerForm.formState.errors.email?.message}
              {...registerForm.register('email')}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <FormInput
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
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

          <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 p-3">
            <label htmlFor="register-privacy" className="flex items-start gap-2.5 cursor-pointer">
              <input
                id="register-privacy"
                type="checkbox"
                aria-invalid={Boolean(registerForm.formState.errors.privacyAccepted)}
                aria-describedby={
                  registerForm.formState.errors.privacyAccepted ? 'register-privacy-error' : undefined
                }
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-600 accent-[var(--primary)]"
                {...registerForm.register('privacyAccepted')}
              />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                I agree to MuntiCares storing the details I provide &mdash; contact info, address, and care details &mdash; to coordinate my home care securely under privacy guidelines.
              </span>
            </label>
            {registerForm.formState.errors.privacyAccepted && (
              <p id="register-privacy-error" className="mt-1 text-xs font-medium text-danger dark:text-danger-dark">
                {registerForm.formState.errors.privacyAccepted.message}
              </p>
            )}
          </div>

          {error && (
            <div className="bg-danger/10 text-danger dark:text-danger-dark p-3 rounded-xl text-xs font-medium text-center ring-1 ring-red-500/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`neu-btn-primary w-full py-3.5 rounded-xl text-sm font-bold text-white shadow-md cursor-pointer active:scale-[0.99] transition-all ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
      </motion.div>
    );
  };

  return (
    <main ref={pageRef} className="min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-4.5rem)] w-full flex flex-col justify-center">
      {/* 50/50 Desktop Split-Screen Architecture */}
      <div className="w-full flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-4.5rem)]">
        
        {/* Left Column: Landing Page Hero Section Content (Theme-Aware, Vertically Centered, Desktop Only) */}
        <div className="hidden lg:flex lg:col-span-6 relative overflow-hidden bg-secondary text-slate-900 dark:bg-slate-950 dark:text-white p-8 sm:p-12 lg:p-16 flex-col justify-center border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-slate-800 transition-colors duration-200">
          {/* Cinematic backdrop with theme-aware wash (Exact Hero Section Background) */}
          <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
            <div ref={bgRef} className="h-full w-full">
              <img
                src={IMAGES.landing.heroWash}
                alt=""
                className="h-full w-full object-cover opacity-60 contrast-105 saturate-110 dark:grayscale dark:mix-blend-luminosity dark:opacity-90 dark:contrast-125"
                loading="eager"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-secondary/70 via-white/60 to-white/85 dark:from-slate-950/85 dark:via-slate-950/75 dark:to-slate-900" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.06)_75%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.55)_75%)]" />
          </div>

          {/* Hero Section Content (Vertically Centered) */}
          <div className="relative z-10 space-y-4 max-w-xl">
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-primary dark:text-[#8CBDF0]">
              MuntiCares
            </span>
            <h1 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl text-slate-900 dark:text-white tracking-tight leading-[1.12]">
              Quality home care <br />right at your{' '}
              <span className="text-primary dark:text-[#8CBDF0]">
                doorstep
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-md">
              Connecting Muntinlupa City residents with trusted, verified home care providers &mdash; fast, secure, and patient-first.
            </p>
          </div>
        </div>

        {/* Right Column: Clean Authentication Form */}
        <div className="col-span-1 lg:col-span-6 bg-secondary dark:bg-slate-950 flex items-center justify-center p-4 py-8 sm:p-8 lg:p-12">
          <div className="w-full max-w-md mx-auto space-y-4 sm:space-y-5">
            
            {/* Top Switcher: Clean Segment Control */}
            {!pendingSetPassword && (
              <div className="flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-300/70 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); }}
                  className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white dark:bg-slate-800 text-link font-black shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(''); }}
                  className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white dark:bg-slate-800 text-link font-black shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Register
                </button>
              </div>
            )}

            {/* Form Container Card */}
            <motion.div
              className={`rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 sm:p-7 shadow-xl ${
                shake ? 'animate-shake' : ''
              }`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: FLUID }}
            >
              <div className="mb-4">
                <h2 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white tracking-tight">
                  {mode === 'login' ? 'Welcome back' : 'Create an Account'}
                </h2>
                <p className="text-xs sm:text-sm text-tertiary mt-0.5">
                  {mode === 'login'
                    ? 'Sign in to access your healthcare portal.'
                    : 'Register to connect with verified home care.'}
                </p>
              </div>

              <AnimatePresence mode="wait">
                {formContent(mode === 'login')}
              </AnimatePresence>

              {!pendingSetPassword && mode === 'login' && (
                <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800/80 text-center">
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setError(''); }}
                    className="text-xs sm:text-sm font-bold text-link hover:underline transition-colors"
                  >
                    New here? Create an account
                  </button>
                </div>
              )}

              {!pendingSetPassword && mode === 'register' && (
                <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800/80 text-center">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); }}
                    className="text-xs sm:text-sm font-bold text-link hover:underline transition-colors"
                  >
                    Already have an account? Sign in
                  </button>
                </div>
              )}
            </motion.div>

          </div>
        </div>

      </div>
    </main>
  );
};

export default AuthPage;
