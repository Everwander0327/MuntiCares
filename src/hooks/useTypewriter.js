import { useEffect, useRef } from 'react';

const useTypewriter = (phrases, { typeSpeed = 80, deleteSpeed = 50, pauseDuration = 2000 } = {}) => {
  const elRef = useRef(null);
  const stateRef = useRef({ text: '', phraseIndex: 0, isDeleting: false });
  const pausedRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      if (pausedRef.current) {
        timerRef.current = setTimeout(tick, 100);
        return;
      }

      const s = stateRef.current;
      const current = phrases[s.phraseIndex];

      if (!s.isDeleting) {
        s.text = current.substring(0, s.text.length + 1);
        if (s.text.length === current.length) {
          setTimeout(() => { s.isDeleting = true; }, pauseDuration);
        }
      } else {
        s.text = current.substring(0, s.text.length - 1);
        if (s.text.length === 0) {
          s.isDeleting = false;
          s.phraseIndex = (s.phraseIndex + 1) % phrases.length;
        }
      }

      if (elRef.current) {
        elRef.current.textContent = s.text;
      }

      timerRef.current = setTimeout(tick, s.isDeleting ? deleteSpeed : typeSpeed);
    };

    timerRef.current = setTimeout(tick, typeSpeed);

    // IntersectionObserver to pause when hero is out of view
    const observer = new IntersectionObserver(
      ([entry]) => { pausedRef.current = !entry.isIntersecting; },
      { threshold: 0 }
    );

    // Find the element that contains the typewriter text
    const findContainer = () => {
      const el = document.getElementById('hero');
      if (el) observer.observe(el);
    };

    // Small delay to ensure DOM is ready
    const initTimer = setTimeout(findContainer, 100);

    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(initTimer);
      observer.disconnect();
    };
  }, [phrases, typeSpeed, deleteSpeed, pauseDuration]);

  return elRef;
};

export default useTypewriter;
