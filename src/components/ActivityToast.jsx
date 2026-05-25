import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

const actionMap = {
  'Nursing Care': 'booked nursing care',
  'Physical Therapy': 'scheduled therapy',
  'Companion Care': 'started companion care',
  'Personal Care': 'requested personal care',
  'Home Health Aide': 'found a caregiver',
};
const fallbackAction = 'booked a session';

const ActivityToast = () => {
  const [current, setCurrent] = useState(null);
  const [visible, setVisible] = useState(false);
  const queueRef = useRef([]);
  const visibleRef = useRef(false);
  const timerRef = useRef(null);

  const showNext = useCallback(() => {
    if (queueRef.current.length === 0) return;

    const idx = Math.floor(Math.random() * queueRef.current.length);
    const item = queueRef.current.splice(idx, 1)[0];
    setCurrent(item);
    setVisible(true);
    visibleRef.current = true;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      visibleRef.current = false;
      timerRef.current = setTimeout(() => {
        if (queueRef.current.length > 0) showNext();
      }, 5000);
    }, 4000);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('landing-activity')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'requests' },
        async (payload) => {
          const { patient_id, service } = payload.new;
          if (!patient_id) return;

          try {
            const { data: userData } = await supabase
              .from('users')
              .select('full_name')
              .eq('id', patient_id)
              .single();

            const { data: patientData } = await supabase
              .from('patients')
              .select('address')
              .eq('user_id', patient_id)
              .single();

            const name = userData?.full_name || 'Someone';
            const address = patientData?.address || '';
            const barangay = address.split(',').pop()?.trim() || address || 'Muntinlupa';
            const action = actionMap[service] || fallbackAction;

            queueRef.current.push({ name, barangay, action });

            if (!visibleRef.current) showNext();
          } catch (err) {
            console.warn('Failed to fetch activity data:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(timerRef.current);
    };
  }, [showNext]);

  return (
    <AnimatePresence>
      {visible && current && (
        <motion.div
          initial={{ y: 80, x: -80, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, x: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, x: -80, opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed bottom-24 left-4 z-40 max-w-[280px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 px-4 py-3 pointer-events-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-7 w-7 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-7 w-7 bg-green-500 items-center justify-center text-white text-[10px] font-bold">
                {current.name[0]}
              </span>
            </div>
            <div className="text-xs">
              <p className="text-slate-900 dark:text-slate-100 font-semibold">
                {current.name} from <span className="text-primary">{current.barangay}</span>
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-[10px]">{current.action}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ActivityToast;
