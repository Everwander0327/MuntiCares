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

const FormCheckbox = React.forwardRef(({ label, error, className, labelClassName, ...props }, ref) => (
  <div className="space-y-1">
    <label className="flex items-center gap-3 cursor-pointer group">
      <input
        type="checkbox"
        ref={ref}
        className={cn(
          "w-5 h-5 rounded-md border-2 transition-all duration-700 ease-fluid cursor-pointer",
          "focus:outline-none focus:ring-0",
          "accent-primary",
          className
        )}
        {...props}
      />
      <span className={cn("text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-slate-100 transition-all duration-700 ease-fluid", labelClassName)}>
        {label}
      </span>
    </label>
    {error && <p className="text-xs text-red-500 dark:text-red-400 ml-1">{error}</p>}
  </div>
));

FormCheckbox.displayName = 'FormCheckbox';

export { FormInput, FormTextarea, FormCheckbox };
