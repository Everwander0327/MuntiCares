import { useState, useCallback, useRef, useEffect } from 'react';

const useTilt = (maxTilt = 8) => {
  const ref = useRef(null);
  const [style, setStyle] = useState({});
  const isTouchRef = useRef(false);

  useEffect(() => {
    isTouchRef.current = window.matchMedia('(pointer: coarse)').matches;
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (isTouchRef.current || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const tiltX = (y - 0.5) * -maxTilt;
    const tiltY = (x - 0.5) * maxTilt;
    setStyle({
      transform: `perspective(600px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
      transition: 'transform 0.1s ease-out',
    });
  }, [maxTilt]);

  const handleMouseLeave = useCallback(() => {
    if (isTouchRef.current) return;
    setStyle({
      transform: 'perspective(600px) rotateX(0) rotateY(0)',
      transition: 'transform 0.4s ease-out',
    });
  }, []);

  return { ref, style, handleMouseMove, handleMouseLeave };
};

export default useTilt;
