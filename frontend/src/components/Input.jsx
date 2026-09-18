import React from "react";

/**
 * Stitch Design System Form Input
 * Specs:
 * - Height: 48px
 * - Radii: 8px (rounded-lg)
 * - Border: 1px solid #E2E8F0
 * - Focus state: Border #004FC5 with 3px focus ring rgba(0, 79, 197, 0.12)
 * - Text: body-md (#0F172A), placeholder (#94A3B8)
 */
export default function Input({
  label,
  helperText,
  error,
  leftIcon,
  rightIcon,
  className = "",
  id,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
            {leftIcon}
          </div>
        )}

        <input
          id={inputId}
          className={`w-full h-12 rounded-lg bg-white border ${
            error ? "border-error-crimson" : "border-border-hairline"
          } text-sm text-slate-900 placeholder:text-slate-400 transition-all outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 ${
            leftIcon ? "pl-11" : "px-4"
          } ${rightIcon ? "pr-11" : "px-4"} ${className}`}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3.5 text-slate-400 flex items-center">
            {rightIcon}
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-1.5 text-xs text-error-crimson font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1.5 text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
}
