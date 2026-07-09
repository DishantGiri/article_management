import React from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  subLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, label, subLabel, disabled = false, className = "" }: ToggleProps) {
  return (
    <div className={`flex items-center gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-[20px] w-[36px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
          checked ? "bg-indigo-500" : "bg-slate-300"
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span className="sr-only">Use setting</span>
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-[16px] w-[16px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-[16px]" : "translate-x-0"
          }`}
        />
      </button>
      
      {(label || subLabel) && (
        <div 
          onClick={() => !disabled && onChange(!checked)}
          className="flex flex-col"
        >
          {label && <span className="text-sm font-bold text-slate-700">{label}</span>}
          {subLabel && <span className="text-[10px] text-slate-500 font-medium leading-none mt-0.5">{subLabel}</span>}
        </div>
      )}
    </div>
  );
}
