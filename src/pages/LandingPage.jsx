import React from 'react';
import { 
  Calendar, 
  ShieldCheck, 
  Lock, 
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import heroImage from '../assets/hero.png';

const Hero = () => {
  return (
    <section className="pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 text-center md:text-left space-y-8 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-primary px-4 py-2 rounded-full text-sm font-semibold animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Muntinlupa City's Trusted Network
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 leading-tight">
              Quality Home Care, <br className="hidden md:block" />
              <span className="text-primary">Right at Your Doorstep</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-xl mx-auto md:mx-0">
              Connecting Muntinlupa City residents with trusted, verified home care providers — fast, secure, and patient-first.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start pt-4">
              <Link to="/patient/providers" className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center group">
                Find a Provider <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/register" className="btn-outline w-full sm:w-auto justify-center">
                Register as Provider
              </Link>
            </div>
          </div>
          <div className="flex-1 relative w-full max-w-xl mx-auto">
            <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-500 border-8 border-white">
              <img 
                src={heroImage} 
                alt="Home Care Provider" 
                className="w-full h-auto object-cover"
              />
            </div>
            <div className="absolute -top-10 -right-10 w-64 h-64 bg-blue-200 rounded-full blur-3xl opacity-30 -z-10"></div>
            <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-blue-300 rounded-full blur-3xl opacity-30 -z-10"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Features = () => {
  const features = [
    {
      icon: <Calendar className="w-8 h-8 text-primary" />,
      title: "Easy Booking",
      description: "Book a professional provider in minutes with our streamlined scheduling system."
    },
    {
      icon: <ShieldCheck className="w-8 h-8 text-primary" />,
      title: "Verified Providers",
      description: "All providers undergo rigorous background checks and credential verification."
    },
    {
      icon: <Lock className="w-8 h-8 text-primary" />,
      title: "Secure Health Data",
      description: "You have full control over your information. We prioritize your privacy and security."
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Why MuntiCares?</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">We're committed to providing the safest and most efficient home care connection in the city.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <div key={idx} className="card group">
              <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-100 group-hover:bg-primary group-hover:shadow-primary/30 transition-all duration-300">
                {React.cloneElement(feature.icon, { className: "w-8 h-8 text-primary group-hover:text-white transition-colors" })}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const HowItWorks = () => {
  const steps = [
    {
      number: "01",
      title: "Create your profile",
      description: "Sign up and tell us about your care needs or professional skills."
    },
    {
      number: "02",
      title: "Find and request",
      description: "Browse verified profiles and send a request to your preferred provider."
    },
    {
      number: "03",
      title: "Manage your care",
      description: "Schedule visits, track care progress, and manage payments securely."
    }
  ];

  return (
    <section className="py-24 bg-secondary/50">
      <div className="container mx-auto px-6">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">How It Works</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">Getting the care you need is simpler than you think.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-12 relative">
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-blue-100 -z-10"></div>
          
          {steps.map((step, idx) => (
            <div key={idx} className="flex-1 bg-white p-8 rounded-3xl shadow-xl shadow-blue-900/5 border border-blue-50 relative transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-2">
              <div className="absolute -top-6 left-8 bg-primary text-white w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-200">
                {step.number}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4 mt-4">{step.title}</h3>
              <p className="text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const LandingPage = () => {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="bg-primary rounded-[3rem] p-12 md:p-20 text-center text-white relative overflow-hidden shadow-2xl shadow-blue-200">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            
            <div className="relative z-10 space-y-8">
              <h2 className="text-3xl md:text-5xl font-bold">Ready to experience better care?</h2>
              <p className="text-blue-100 text-lg max-w-2xl mx-auto">
                Join hundreds of families in Muntinlupa City who trust MuntiCares for their home healthcare needs.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/register" className="bg-white text-primary px-8 py-4 rounded-2xl font-bold text-lg hover:bg-blue-50 transition-colors shadow-xl">
                  Get Started Now
                </Link>
                <button className="bg-transparent border-2 border-white/30 hover:border-white text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all">
                  Learn More
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default LandingPage;
