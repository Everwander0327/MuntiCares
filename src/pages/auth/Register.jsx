import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Mail, Lock, User, UserCheck } from 'lucide-react';

const RegisterPage = () => {
  const [role, setRole] = useState('patient');
  const navigate = useNavigate();

  const handleRegister = (e) => {
    e.preventDefault();
    if (role === 'patient') navigate('/patient/dashboard');
    else navigate('/provider/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 pt-32 pb-20">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-slate-100 p-8 md:p-12">
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
            <div 
              onClick={() => setRole('patient')}
              className={`cursor-pointer p-6 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-3 ${role === 'patient' ? 'border-primary bg-blue-50 shadow-lg shadow-primary/10' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${role === 'patient' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                🧑‍⚕️
              </div>
              <div>
                <p className="font-bold text-slate-900">I'm a Patient</p>
                <p className="text-xs text-slate-500 mt-1">Looking for care services</p>
              </div>
            </div>
            <div 
              onClick={() => setRole('provider')}
              className={`cursor-pointer p-6 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-3 ${role === 'provider' ? 'border-primary bg-blue-50 shadow-lg shadow-primary/10' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${role === 'provider' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                👨‍⚕️
              </div>
              <div>
                <p className="font-bold text-slate-900">I'm a Provider</p>
                <p className="text-xs text-slate-500 mt-1">Offering professional care</p>
              </div>
            </div>
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Confirm Password</label>
              <div className="relative">
                <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="password" 
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>
          </div>

          <button className="btn-primary w-full py-4 text-lg shadow-lg shadow-primary/30">
            Create Account
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-500">
            Already have an account? <Link to="/login" className="text-primary font-bold hover:underline">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
