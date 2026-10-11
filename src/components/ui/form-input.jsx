import React from 'react';
import { cn } from '../../lib/utils';

const FormInput = React.forwardRef(({ label, error, icon: Icon, rightElement, className, ...props }, ref) => {
  return (
    <div className="space-y-1 sm:space-y-1.5">
      {label && <label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 ml-1">{label}</label>}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 sm:left-4 z-10 pointer-events-none flex items-center justify-center text-slate-400 dark:text-slate-500">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 dark:text-slate-500" />
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full neu-inset neu-input text-slate-800 dark:text-slate-100 rounded-xl sm:rounded-2xl py-2.5 sm:py-3",
            Icon ? "!pl-10 sm:!pl-12" : "px-3.5 sm:px-4",
            rightElement ? "!pr-10 sm:!pr-12" : "pr-3.5 sm:pr-4",
            "focus:outline-none text-xs sm:text-sm font-semibold transition-all duration-300",
            error ? "ring-1 ring-red-400 dark:ring-red-500" : "",
            className
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-3.5 sm:right-4 z-10 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
      {error && <p className="text-[11px] sm:text-xs text-red-500 dark:text-red-400 mt-0.5 ml-1">{error}</p>}
    </div>
  );
});

FormInput.displayName = 'FormInput';

const FormTextarea = React.forwardRef(({ label, error, className, ...props }, ref) => (
  <div className="space-y-2">
    {label && <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 ml-1">{label}</label>}
    <textarea
      ref={ref}
      className={cn(
        "w-full neu-inset neu-input text-slate-800 dark:text-slate-100 rounded-2xl p-4",
        "focus:outline-none text-xs sm:text-sm font-semibold transition-all duration-300 resize-none",
        error ? "ring-1 ring-red-400 dark:ring-red-500" : "",
        className
      )}
      {...props}
    />
    {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1 ml-1">{error}</p>}
  </div>
));

FormTextarea.displayName = 'FormTextarea';

const FormCheckbox = React.forwardRef(({ label, error, className, labelClassName, checked, defaultChecked, onChange, ...props }, ref) => {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked || false);
  const isChecked = checked !== undefined ? checked : internalChecked;

  const handleChange = (e) => {
    if (checked === undefined) {
      setInternalChecked(e.target.checked);
    }
    if (onChange) onChange(e);
  };

  return (
    <div className="space-y-1">
      <label className="inline-flex items-center gap-2.5 cursor-pointer group select-none">
        <div className="relative flex items-center justify-center shrink-0">
          <input
            type="checkbox"
            ref={ref}
            checked={checked}
            defaultChecked={defaultChecked}
            onChange={handleChange}
            className="sr-only peer"
            {...props}
          />
          <div className={cn(
            "w-5 h-5 rounded-lg transition-all duration-200 flex items-center justify-center",
            "peer-checked:neu-btn-primary peer-checked:text-white",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40",
            isChecked ? "neu-btn-primary text-white" : "neu-inset border border-slate-200/40 dark:border-white/5 text-transparent",
            className
          )}>
            <svg 
              className={cn("w-3.5 h-3.5 stroke-[3] transition-transform duration-200", isChecked ? "scale-100 text-white" : "scale-0 text-transparent")} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <span className={cn("text-xs sm:text-[13px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors", labelClassName)}>
          {label}
        </span>
      </label>
      {error && <p className="text-xs text-red-500 dark:text-red-400 ml-1">{error}</p>}
    </div>
  );
});

FormCheckbox.displayName = 'FormCheckbox';

export { FormInput, FormTextarea, FormCheckbox };
