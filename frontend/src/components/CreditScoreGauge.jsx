import React from "react";

/**
 * Stitch Design System Credit Score Radial Gauge
 * Specs:
 * - High-prominence circular gauge (300 to 850 range)
 * - 10px stroke weight with #E2E8F0 background track
 * - Semantic active fill:
 *   - Prime (>= 750): #0D9488 (Teal)
 *   - Standard (>= 650): #004FC5 (Primary Royal Blue)
 *   - Developing (< 650): #F59E0B (Amber)
 * - Numerical score in tabular font-mono, paired with uppercase tier badge
 */
export default function CreditScoreGauge({
  score = 750,
  minScore = 300,
  maxScore = 850,
  size = 220,
  showTierBadge = true,
  className = "",
}) {
  const clampedScore = Math.max(minScore, Math.min(maxScore, score));
  const percentage = (clampedScore - minScore) / (maxScore - minScore);

  // SVG Gauge calculations (260 degree arc)
  const strokeWidth = 12;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  // Use a 240-degree open gauge at the bottom
  const arcLength = circumference * (240 / 360);
  const strokeDashoffset = arcLength - percentage * arcLength;

  // Semantic tier allocation
  let tierName = "Developing";
  let tierColor = "#F59E0B"; // Amber
  let tierBg = "bg-amber-50 text-amber-600 border-amber-200/60";

  if (clampedScore >= 750) {
    tierName = "Prime Score";
    tierColor = "#0D9488"; // Teal
    tierBg = "bg-teal-50 text-teal-700 border-teal-200/60";
  } else if (clampedScore >= 650) {
    tierName = "Standard Score";
    tierColor = "#004FC5"; // Royal Blue
    tierBg = "bg-blue-50 text-primary border-blue-200/60";
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="rotate-[150deg] transform origin-center"
        >
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />

          {/* Active Score Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={tierColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center Score Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
            Settl Credit Score
          </span>
          <span className="text-5xl font-extrabold font-mono text-slate-900 tracking-tight">
            {clampedScore}
          </span>
          <span className="text-xs text-slate-400 font-mono mt-0.5">
            {minScore} – {maxScore} Range
          </span>
        </div>
      </div>

      {showTierBadge && (
        <div className={`mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${tierBg}`}>
          {tierName}
        </div>
      )}
    </div>
  );
}
