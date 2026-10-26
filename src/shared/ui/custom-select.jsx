import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CustomSelect = ({ value, onChange, options, placeholder = "Select option", className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={selectRef} className={`relative z-30 ${className}`}>
      {/* Neumorphic Button Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full neu-btn flex items-center justify-between gap-2 px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 min-h-[42px] cursor-pointer active:scale-95 transition-all outline-none"
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          className={`w-3.5 h-3.5 text-link shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Neumorphic Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="neu-flat absolute left-0 right-0 sm:left-auto sm:right-0 top-full mt-2 z-50 bg-surface-shell rounded-2xl border border-white/80 dark:border-white/10 shadow-2xl p-1.5 min-w-[150px] w-full"
          >
            {options.map((option) => {
              const isChecked = option.value === value;
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                    isChecked
                      ? 'neu-inset text-link font-black bg-primary/10'
                      : 'text-slate-700 dark:text-slate-200 hover:text-link hover:bg-primary/5'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isChecked && <Check className="w-3.5 h-3.5 text-link stroke-[3] shrink-0 ml-1.5" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomSelect;
