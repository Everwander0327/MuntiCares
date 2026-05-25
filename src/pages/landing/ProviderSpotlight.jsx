import { useState, useEffect, useCallback } from 'react';
import { Star, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

const initials = (name) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

const ProviderSpotlight = () => {
  const [providers, setProviders] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const { data, error } = await supabase
          .from('providers')
          .select('id, user_id, rating, services, user:user_id(full_name)')
          .eq('is_approved', true)
          .not('rating', 'is', null)
          .order('rating', { ascending: false });

        if (error) throw error;

        const { data: reviewsData } = await supabase
          .from('provider_reviews')
          .select('provider_id');

        const reviewCounts = {};
        (reviewsData || []).forEach((r) => {
          reviewCounts[r.provider_id] = (reviewCounts[r.provider_id] || 0) + 1;
        });

        const shaped = (data || []).map((p) => ({
          name: p.user?.full_name || 'Unknown',
          specialty: p.services?.[0] || 'Healthcare Professional',
          rating: p.rating || 0,
          reviews: reviewCounts[p.user_id] || 0,
        }));

        setProviders(shaped);
      } catch (err) {
        console.warn('Failed to fetch providers for spotlight:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, []);

  const next = useCallback(() => {
    setIndex((prev) => (prev + 1) % providers.length);
  }, [providers.length]);

  useEffect(() => {
    if (providers.length < 2) return;
    const interval = setInterval(next, 5000);
    return () => clearInterval(interval);
  }, [next, providers.length]);

  if (loading || providers.length === 0) return null;

  const p = providers[index];

  return (
    <section id="spotlight" className="py-10 bg-white dark:bg-slate-800">
      <div className="container mx-auto px-6 text-center">
        <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Featured Provider</p>
        <div className="max-w-sm mx-auto relative min-h-[180px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl ring-[3px] ring-primary/20">
                {initials(p.name)}
              </div>
              <div>
                <p className="text-base font-bold text-slate-900 dark:text-slate-100">{p.name}</p>
                <div className="flex items-center justify-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>{p.specialty}</span>
                </div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{p.rating}</span>
                  <span className="text-slate-400 text-sm">({p.reviews} reviews)</span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-center gap-2 mt-6">
            {providers.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  idx === index ? 'bg-primary w-6' : 'bg-slate-300 dark:bg-slate-600'
                }`}
                aria-label={`Show ${providers[idx].name}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProviderSpotlight;
