import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

const AuthPage = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('demo');
  const [showPass, setShowPass] = useState(false);

  // login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // register
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  const setDemoUser = (role) => {
    const users = {
      patient: { id: 'p1', full_name: 'Juan Dela Cruz', email: 'juan@example.com', role: 'patient' },
      provider: { id: 'pr1', full_name: 'Maria Reyes', email: 'maria@example.com', role: 'provider' },
      admin: { id: 'a1', full_name: 'Admin User', email: 'admin@mnticares.com', role: 'admin' },
    };
    localStorage.setItem('mc_user', JSON.stringify(users[role]));
    navigate(`/${role}/dashboard`);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setDemoUser('patient');
  };

  const handleRegister = (e) => {
    e.preventDefault();
    setDemoUser('patient');
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-blue-600 to-indigo-900 items-center justify-center p-12">
        <div className="text-white text-center">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="bg-white/20 p-3 rounded-xl">
              <Heart className="w-8 h-8 text-white" fill="currentColor" />
            </div>
            <span className="text-3xl font-bold">MuntiCares</span>
          </div>
          <h2 className="text-4xl font-bold mb-4">Your Health, Our Priority</h2>
          <p className="text-white/70 text-lg max-w-sm mx-auto">Muntinlupa's trusted home care platform.</p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 lg:hidden mb-4">
              <div className="bg-primary p-1.5 rounded-lg">
                <Heart className="text-white w-5 h-5" fill="currentColor" />
              </div>
              <span className="text-xl font-bold text-primary">MuntiCares</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome</h1>
            <p className="text-slate-500 mt-1">Sign in or explore as a guest</p>
          </div>

          <div className="flex gap-2 bg-slate-100 rounded-xl p-1 mb-6">
            {['demo', 'login', 'register'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${tab === t ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {t === 'demo' ? 'Guest' : t}
              </button>
            ))}
          </div>

          {tab === 'demo' && (
            <>
              <div className="space-y-3 mb-6">
                <button onClick={() => setDemoUser('patient')}
                  className="w-full p-4 rounded-2xl border-2 border-blue-100 hover:border-primary hover:bg-blue-50 transition-all text-left flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-primary font-bold text-lg">P</div>
                  <div><p className="font-bold text-slate-900">Patient</p><p className="text-sm text-slate-500">Browse providers, book services</p></div>
                </button>
                <button onClick={() => setDemoUser('provider')}
                  className="w-full p-4 rounded-2xl border-2 border-green-100 hover:border-green-500 hover:bg-green-50 transition-all text-left flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-green-600 font-bold text-lg">P</div>
                  <div><p className="font-bold text-slate-900">Provider</p><p className="text-sm text-slate-500">Manage requests and patients</p></div>
                </button>
                <button onClick={() => setDemoUser('admin')}
                  className="w-full p-4 rounded-2xl border-2 border-purple-100 hover:border-purple-500 hover:bg-purple-50 transition-all text-left flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-lg">A</div>
                  <div><p className="font-bold text-slate-900">Admin</p><p className="text-sm text-slate-500">Platform management</p></div>
                </button>
              </div>
            </>
          )}

          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">Email</label>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 focus-within:border-primary transition-all">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="you@example.com" required className="flex-1 bg-transparent outline-none text-slate-900 placeholder:text-slate-400" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">Password</label>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 focus-within:border-primary transition-all">
                  <Lock className="w-5 h-5 text-slate-400" />
                  <input type={showPass ? 'text' : 'password'} value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="Enter password" required className="flex-1 bg-transparent outline-none text-slate-900 placeholder:text-slate-400" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button type="submit" className="w-full py-3 rounded-xl bg-primary text-white font-bold text-lg hover:bg-blue-600 transition-all shadow-lg shadow-primary/25">Sign In</button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">Full Name</label>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 focus-within:border-primary transition-all">
                  <User className="w-5 h-5 text-slate-400" />
                  <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="Juan Dela Cruz" required className="flex-1 bg-transparent outline-none text-slate-900 placeholder:text-slate-400" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">Email</label>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 focus-within:border-primary transition-all">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="you@example.com" required className="flex-1 bg-transparent outline-none text-slate-900 placeholder:text-slate-400" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">Password</label>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 focus-within:border-primary transition-all">
                  <Lock className="w-5 h-5 text-slate-400" />
                  <input type={showPass ? 'text' : 'password'} value={regPass} onChange={e => setRegPass(e.target.value)} placeholder="Create a password" required className="flex-1 bg-transparent outline-none text-slate-900 placeholder:text-slate-400" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">Confirm Password</label>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 focus-within:border-primary transition-all">
                  <Lock className="w-5 h-5 text-slate-400" />
                  <input type={showPass ? 'text' : 'password'} value={regConfirm} onChange={e => setRegConfirm(e.target.value)} placeholder="Confirm password" required className="flex-1 bg-transparent outline-none text-slate-900 placeholder:text-slate-400" />
                </div>
              </div>
              <button type="submit" className="w-full py-3 rounded-xl bg-primary text-white font-bold text-lg hover:bg-blue-600 transition-all shadow-lg shadow-primary/25">Create Account</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
