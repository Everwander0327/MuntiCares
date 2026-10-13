import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

const ThemeToggle = ({ className = '' }) => {
  const { dark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className={`neu-btn w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${className}`}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? (
        <Sun className="w-5 h-5 text-yellow-400" />
      ) : (
        <Moon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
      )}
    </button>
  );
};

export default ThemeToggle;
