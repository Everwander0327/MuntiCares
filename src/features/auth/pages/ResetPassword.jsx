import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { FormInput } from '@/shared/ui';
import { PageMeta } from '@/shared/components';

const requestSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

const resetSchema = z.object({
  password: z.string().min(6, 'At least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

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

const ResetPassword = () => {
  const navigate = useNavigate();
  const { user, authInitialized, setPassword, logout } = useAuth();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const requestForm = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: '' },
  });

  const resetForm = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const handleRequest = async (data) => {
    setError('');
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(data.email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw new Error(resetError.message);
      setSent(true);
    } catch (err) {
      const message = err.message || 'Could not send the reset email';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (data) => {
    setError('');
    setLoading(true);
    try {
      await setPassword({ password: data.password });
      await logout();
      toast.success('Password updated! Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (err) {
      const message = err.message || 'Could not update the password';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!authInitialized) {
    return <main className="min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-4.5rem)] w-full" />;
  }

  return (
    <main className="min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-4.5rem)] w-full bg-secondary dark:bg-slate-950 flex items-center justify-center p-6 sm:p-10">
      <PageMeta
        title="Reset your password — MuntiCares"
        description="Request a MuntiCares password reset link and choose a new password for your home care account."
        path="/reset-password"
      />
      <div className="w-full max-w-md rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 sm:p-7 shadow-xl">
        <div className="mb-4 text-center">
          <h2 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white tracking-tight">
            Reset Password
          </h2>
          <p className="text-xs sm:text-sm text-tertiary mt-0.5">
            {user
              ? `Choose a new password for ${user.email}`
              : 'Enter your account email and we will send you a reset link.'}
          </p>
        </div>

        {!user && !sent && (
          <form className="space-y-4" onSubmit={requestForm.handleSubmit(handleRequest)}>
            <FormInput
              label="Email Address"
              type="email"
              autoComplete="email"
              placeholder="juan.delacruz@example.com"
              className="!py-2.5"
              error={requestForm.formState.errors.email?.message}
              {...requestForm.register('email')}
            />
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
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <div className="text-center">
              <Link to="/login" className="text-xs sm:text-sm font-bold text-link hover:underline transition-colors">
                Back to sign in
              </Link>
            </div>
          </form>
        )}

        {!user && sent && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              If an account exists for that address, a reset link is on its way. Check your inbox (and spam folder).
            </p>
            <Link to="/login" className="inline-block text-xs sm:text-sm font-bold text-link hover:underline transition-colors">
              Back to sign in
            </Link>
          </div>
        )}

        {user && (
          <form className="space-y-4" onSubmit={resetForm.handleSubmit(handleReset)}>
            <FormInput
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              className="!py-2.5"
              error={resetForm.formState.errors.password?.message}
              rightElement={<PasswordToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
              {...resetForm.register('password')}
            />
            <FormInput
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              className="!py-2.5"
              error={resetForm.formState.errors.confirmPassword?.message}
              rightElement={<PasswordToggle show={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} />}
              {...resetForm.register('confirmPassword')}
            />
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
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
};

export default ResetPassword;
