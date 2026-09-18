import React from "react";

/**
 * Settl Brand Logo
 * Direct SVG vectors extracted from Stitch Project 12860544196208032886
 * Variants:
 * - "wordmark": Standard pill badge logo with card/lettering
 * - "bars": 3-tier stepped perspective gradient bars representing credit growth
 */
export default function SettlLogo({ variant = "bars", className = "h-9", textColor = "#0F172A" }) {
  if (variant === "wordmark") {
    return (
      <svg
        viewBox="0 0 160 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <rect x="2" y="6" width="36" height="36" rx="10" fill="#004FC5" />
        <path
          d="M14 26C15.5 28.5 18 30 21 30C25 30 27 27.5 27 25C27 20 14 22 14 16C14 12.5 17 10 21 10C24 10 26.5 11.5 27.8 13.5"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M22 34V36" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M20 8V6" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        <text
          x="48"
          y="32"
          fontFamily="Plus Jakarta Sans, sans-serif"
          fontSize="24"
          fontWeight="700"
          fill={textColor}
          letterSpacing="-0.5px"
        >
          Settl
        </text>
        <circle cx="106" cy="30" r="3" fill="#004FC5" />
      </svg>
    );
  }

  // Default: Stepped 3D Bars Mark
  return (
    <svg
      viewBox="0 0 160 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M6 14L16 10V38L6 34V14Z" fill="#004FC5" fillOpacity="0.35" />
      <path d="M19 9L29 5V43L19 39V9Z" fill="#004FC5" fillOpacity="0.65" />
      <path d="M32 4L44 0V48L32 44V4Z" fill="#004FC5" />
      <text
        x="56"
        y="33"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontSize="28"
        fontWeight="800"
        fill={textColor}
        letterSpacing="-0.03em"
      >
        Settl
      </text>
      <circle cx="127" cy="30" r="3.5" fill="#004FC5" />
    </svg>
  );
}
