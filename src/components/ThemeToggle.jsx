import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle = ({ className = '' }) => {
  const { dark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className={`p-2.5 rounded-xl transition-all hover:bg-slate-100 dark:hover:bg-slate-700 ${className}`}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? (
        <Sun className="w-5 h-5 text-yellow-400" />
      ) : (
        <Moon className="w-5 h-5 text-slate-600" />
      )}
    </button>
  );
};

export default ThemeToggle;
