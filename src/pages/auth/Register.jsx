import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Mail, Lock, User, UserCheck, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const RegisterPage = () => {
  const [role, setRole] = useState('patient');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [shake, setShake] = useState(false);
  const navigate = useNavigate();

  const handleRegister = (e) => {
    e.preventDefault();
    const form = e.target;
    const inputs = form.querySelectorAll('input[required]');
    let allFilled = true;
    inputs.forEach(input => {
      if (!input.value) allFilled = false;
    });
    if (!allFilled) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    if (role === 'patient') navigate('/patient/dashboard');
    else navigate('/provider/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 pt-32 pb-20 relative overflow-hidden">
      {/* Animated floating blobs */}
      <div className="absolute top-10 right-20 w-80 h-80 bg-blue-200/25 rounded-full blur-3xl blob-1 pointer-events-none" />
      <div className="absolute bottom-10 left-20 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl blob-2 pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl blob-3 pointer-events-none" />

      <motion.div 
        className={`relative z-10 w-full max-w-2xl rounded-[2.5rem] p-8 md:p-12 border border-white/50 ${shake ? 'animate-shake' : ''}`}
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
          <h1 className="text-2xl font-bold text-slate-900">Create Account</h1>
          <p className="text-slate-500 mt-2">Join Muntinlupa's home care network</p>
        </div>

        <form className="space-y-8" onSubmit={handleRegister}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Patient Role Card */}
            <motion.div 
              onClick={() => setRole('patient')}
              className={`cursor-pointer p-6 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-3 relative overflow-hidden ${role === 'patient' ? 'border-primary bg-blue-50/80 shadow-lg shadow-primary/10' : 'border-slate-200/50 bg-white/50 hover:border-slate-300'}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <AnimatePresence>
                {role === 'patient' && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute top-3 right-3"
                  >
                    <CheckCircle2 className="w-6 h-6 text-primary fill-blue-100" />
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div 
                className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${role === 'patient' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}
                animate={{ scale: role === 'patient' ? 1.1 : 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                🧑‍⚕️
              </motion.div>
              <div>
                <p className="font-bold text-slate-900">I'm a Patient</p>
                <p className="text-xs text-slate-500 mt-1">Looking for care services</p>
              </div>
            </motion.div>

            {/* Provider Role Card */}
            <motion.div 
              onClick={() => setRole('provider')}
              className={`cursor-pointer p-6 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-3 relative overflow-hidden ${role === 'provider' ? 'border-primary bg-blue-50/80 shadow-lg shadow-primary/10' : 'border-slate-200/50 bg-white/50 hover:border-slate-300'}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <AnimatePresence>
                {role === 'provider' && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute top-3 right-3"
                  >
                    <CheckCircle2 className="w-6 h-6 text-primary fill-blue-100" />
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div 
                className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${role === 'provider' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}
                animate={{ scale: role === 'provider' ? 1.1 : 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                👨‍⚕️
              </motion.div>
              <div>
                <p className="font-bold text-slate-900">I'm a Provider</p>
                <p className="text-xs text-slate-500 mt-1">Offering professional care</p>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Juan Dela Cruz"
                  required
                  className="w-full bg-white/70 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="email" 
                  placeholder="juan@example.com"
                  required
                  className="w-full bg-white/70 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white/70 border border-slate-200 rounded-2xl py-4 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Confirm Password</label>
              <div className="relative">
                <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white/70 border border-slate-200 rounded-2xl py-4 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          <motion.button 
            className="btn-primary w-full py-4 text-lg shadow-lg shadow-primary/30"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            Create Account
          </motion.button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-500">
            Already have an account? <Link to="/login" className="text-primary font-bold hover:underline">Login</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
