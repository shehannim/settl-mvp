import React from "react";

/**
 * Stitch Design System Card
 * Implements Level 1 Surface Enclosure:
 * - Pure white #FFFFFF surface
 * - 16px rounded corners (rounded-2xl)
 * - Persistent 1px solid #E2E8F0 hairline border
 * - Ultra-soft shadow: 0px 1px 3px rgba(15,23,42,0.04), 0px 6px 16px rgba(15,23,42,0.02)
 */
export default function Card({
  children,
  title,
  subtitle,
  action,
  className = "",
  padding = "p-6",
  ...props
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-border-hairline shadow-[0_1px_3px_rgba(15,23,42,0.04),0_6px_16px_rgba(15,23,42,0.02)] ${padding} ${className}`}
      {...props}
    >
      {(title || subtitle || action) && (
        <div className="flex items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-100">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
