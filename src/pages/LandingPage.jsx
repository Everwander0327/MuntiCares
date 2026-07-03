import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import heroImage from '../assets/hero.png';

const LandingPage = () => {
  return (
    <div>
      <section className="pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 text-center md:text-left space-y-6 max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-blue-100 text-primary px-4 py-2 rounded-full text-sm font-semibold">
                Muntinlupa City's Trusted Network
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight">
                Quality Home Care, <br />
                <span className="text-primary">Right at Your Doorstep</span>
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed">
                Connecting Muntinlupa City residents with trusted, verified home care providers — fast, secure, and patient-first.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                <Link to="/patient/providers" className="btn-primary flex items-center gap-2">
                  Find a Provider <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/register" className="btn-outline">
                  Register as Provider
                </Link>
              </div>
            </div>
            <div className="flex-1 relative">
              <img src={heroImage} alt="Home Care" className="w-full rounded-2xl shadow-2xl" />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">How It Works</h2>
            <p className="text-slate-600 mt-2">Getting care is simple</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Create Account', desc: 'Sign up as a patient or provider in seconds.' },
              { step: '02', title: 'Find a Match', desc: 'Browse verified providers and send a request.' },
              { step: '03', title: 'Get Care', desc: 'Schedule visits and manage everything online.' },
            ].map((s, i) => (
              <div key={i} className="text-center p-6">
                <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold">{s.step}</div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="bg-primary rounded-[2rem] p-12 text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-blue-100 mb-8 max-w-lg mx-auto">Join hundreds of families in Muntinlupa City who trust MuntiCares.</p>
            <Link to="/register" className="inline-flex items-center gap-2 bg-white text-primary px-8 py-3 rounded-2xl font-bold text-lg hover:bg-blue-50 transition-colors shadow-xl">
              Get Started <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
