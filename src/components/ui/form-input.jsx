import React from 'react';
import { cn } from '../../lib/utils';

const FormInput = React.forwardRef(({ label, error, icon: Icon, rightElement, className, ...props }, ref) => {
  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 ml-1">{label}</label>}
      <div className="relative">
        {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />}
        <input
          ref={ref}
          className={cn(
            "w-full bg-white/80 dark:bg-slate-800/80 ring-1 rounded-[1.25rem] py-4",
            Icon ? "pl-12" : "px-4",
            rightElement ? "pr-12" : "pr-4",
            "focus:outline-none focus:ring-0 transition-all duration-700 ease-fluid",
            error ? "ring-red-300 dark:ring-red-500" : "ring-black/5 dark:ring-white/10",
            className
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-4 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1 ml-1">{error}</p>}
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
        "w-full bg-white/80 dark:bg-slate-800/80 ring-1 rounded-[1.25rem] p-4",
        "focus:outline-none focus:ring-0 transition-all duration-700 ease-fluid resize-none",
        error ? "ring-red-300 dark:ring-red-500" : "ring-black/5 dark:ring-white/10",
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
