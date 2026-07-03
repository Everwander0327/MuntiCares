import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';

const AuthPage = () => {
  const navigate = useNavigate();

  const setDemoUser = (role) => {
    const users = {
      patient: { id: 'p1', full_name: 'Juan Dela Cruz', email: 'juan@example.com', role: 'patient' },
      provider: { id: 'pr1', full_name: 'Maria Reyes', email: 'maria@example.com', role: 'provider' },
      admin: { id: 'a1', full_name: 'Admin User', email: 'admin@mnticares.com', role: 'admin' },
    };
    localStorage.setItem('mc_user', JSON.stringify(users[role]));
    navigate(`/${role}/dashboard`);
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
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 lg:hidden mb-4">
              <div className="bg-primary p-1.5 rounded-lg">
                <Heart className="text-white w-5 h-5" fill="currentColor" />
              </div>
              <span className="text-xl font-bold text-primary">MuntiCares</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Demo Access</h1>
            <p className="text-slate-500 mt-1">Click a role to explore the app</p>
          </div>

          <div className="space-y-3 mb-8">
            <button
              onClick={() => setDemoUser('patient')}
              className="w-full p-4 rounded-2xl border-2 border-blue-100 hover:border-primary hover:bg-blue-50 transition-all text-left flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-primary font-bold text-lg">P</div>
              <div>
                <p className="font-bold text-slate-900">Patient</p>
                <p className="text-sm text-slate-500">Browse providers, book services</p>
              </div>
            </button>

            <button
              onClick={() => setDemoUser('provider')}
              className="w-full p-4 rounded-2xl border-2 border-green-100 hover:border-green-500 hover:bg-green-50 transition-all text-left flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-green-600 font-bold text-lg">P</div>
              <div>
                <p className="font-bold text-slate-900">Provider</p>
                <p className="text-sm text-slate-500">Manage requests and patients</p>
              </div>
            </button>

            <button
              onClick={() => setDemoUser('admin')}
              className="w-full p-4 rounded-2xl border-2 border-purple-100 hover:border-purple-500 hover:bg-purple-50 transition-all text-left flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-lg">A</div>
              <div>
                <p className="font-bold text-slate-900">Admin</p>
                <p className="text-sm text-slate-500">Platform management</p>
              </div>
            </button>
          </div>

          <div className="text-center">
            <p className="text-xs text-slate-400">No registration needed. Click any role to explore.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
