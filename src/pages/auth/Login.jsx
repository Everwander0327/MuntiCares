import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Mail, Lock, User, Shield, Briefcase } from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();

  const handleDemoLogin = (role) => {
    if (role === 'patient') navigate('/patient/dashboard');
    if (role === 'provider') navigate('/provider/dashboard');
    if (role === 'admin') navigate('/admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 pt-32 pb-20">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-slate-100 p-8 md:p-10">
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

        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); alert('In a real app, this would verify your credentials. Use the Demo buttons below for now!'); }}>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="email" 
                placeholder="juan.delacruz@example.com"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="password" 
                placeholder="••••••••"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <button type="submit" className="btn-primary w-full py-4 text-lg shadow-lg shadow-primary/30">
            Login
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-500">
            Don't have an account? <Link to="/register" className="text-primary font-bold hover:underline">Register</Link>
          </p>
        </div>

        <div className="mt-10 pt-8 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-6">Demo Access</p>
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={() => handleDemoLogin('patient')}
              className="flex items-center justify-between bg-blue-50 hover:bg-blue-100 text-primary px-6 py-3 rounded-2xl transition-colors font-semibold group"
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5" />
                <span>Login as Patient</span>
              </div>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>
            <button 
              onClick={() => handleDemoLogin('provider')}
              className="flex items-center justify-between bg-slate-50 hover:bg-slate-100 text-slate-700 px-6 py-3 rounded-2xl transition-colors font-semibold group"
            >
              <div className="flex items-center gap-3">
                <Briefcase className="w-5 h-5" />
                <span>Login as Provider</span>
              </div>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>
            <button 
              onClick={() => handleDemoLogin('admin')}
              className="flex items-center justify-between bg-slate-50 hover:bg-slate-100 text-slate-700 px-6 py-3 rounded-2xl transition-colors font-semibold group"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5" />
                <span>Login as Admin</span>
              </div>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ArrowRight = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

export default LoginPage;
