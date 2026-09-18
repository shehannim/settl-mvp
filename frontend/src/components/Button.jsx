import React from "react";

/**
 * Stitch Design System Button
 * Implements the Modern Financial Inclusion button specs:
 * - primary: Full pill shape (rounded-full), solid #004FC5, white text, hover #0043A8, active press scale-98
 * - secondary: Hairline border 1.5px solid #E2E8F0, white surface, #0F172A text, hover bg-slate-50
 * - ghost: No border, transparent surface, #004FC5 text
 */
export default function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  disabled = false,
  ...props
}) {
  const sizeClasses = {
    sm: "h-9 px-4 text-xs font-semibold",
    md: "h-12 px-6 text-sm font-semibold",
    lg: "h-[52px] px-8 text-base font-bold",
  }[size] || "h-12 px-6 text-sm font-semibold";

  const variantClasses = {
    primary:
      "bg-primary text-white hover:bg-primary-hover active:scale-[0.985] shadow-sm disabled:opacity-50 disabled:pointer-events-none",
    secondary:
      "bg-white border border-border-hairline text-slate-900 hover:bg-slate-50 active:scale-[0.985] shadow-xs disabled:opacity-50 disabled:pointer-events-none",
    ghost:
      "bg-transparent text-primary hover:bg-blue-50/60 active:scale-[0.985] disabled:opacity-50 disabled:pointer-events-none",
    danger:
      "bg-error-crimson text-white hover:bg-red-700 active:scale-[0.985] shadow-sm disabled:opacity-50 disabled:pointer-events-none",
  }[variant] || "bg-primary text-white";

  return (
    <button
      disabled={disabled}
      className={`rounded-full inline-flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer font-sans select-none ${sizeClasses} ${variantClasses} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
