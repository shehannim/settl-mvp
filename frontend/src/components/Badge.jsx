import React from "react";

/**
 * Stitch Design System Status Badges & Chips
 * Specs:
 * - Pill silhouette (rounded-full), padding 4px 12px
 * - success / verified: #F0FDFA background, #0D9488 text, 6px solid dot
 * - warning / pending: #FFFBEB background, #D97706 text, 6px solid dot
 * - error / danger: #FEF2F2 background, #DC2626 text, 6px solid dot
 * - platform / neutral: crisp border 1px solid #E2E8F0, white background, slate-700 text
 */
export default function Badge({
  children,
  variant = "neutral",
  dot = false,
  icon,
  className = "",
  ...props
}) {
  const variantStyles = {
    success: "bg-teal-50/80 text-secondary-teal border border-teal-200/50",
    warning: "bg-amber-50 text-amber-600 border border-amber-200/60",
    danger: "bg-red-50 text-error-crimson border border-red-200/60",
    primary: "bg-blue-50 text-primary border border-blue-200/60",
    neutral: "bg-white text-slate-700 border border-border-hairline",
    ghost: "bg-slate-100 text-slate-600",
  }[variant] || "bg-white text-slate-700 border border-border-hairline";

  const dotStyles = {
    success: "bg-secondary-teal",
    warning: "bg-amber-500",
    danger: "bg-error-crimson",
    primary: "bg-primary",
    neutral: "bg-slate-400",
    ghost: "bg-slate-400",
  }[variant] || "bg-slate-400";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold select-none leading-none ${variantStyles} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotStyles}`} />}
      {icon && <span className="flex items-center">{icon}</span>}
      {children}
    </span>
  );
}
