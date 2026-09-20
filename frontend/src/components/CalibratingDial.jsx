import { useEffect, useState } from "react";

const TOTAL_TICKS = 48;

/**
 * Compact light-theme version of the ScoreCalibration radial dial.
 * Loops 0–100 while work is in flight.
 */
export default function CalibratingDial({ message = "Calibrating your score..." }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 2));
    }, 90);
    return () => clearInterval(interval);
  }, []);

  const activeTicksCount = Math.round((progress / 100) * TOTAL_TICKS);

  return (
    <div className="flex flex-col items-center py-2">
      <div className="relative flex h-44 w-44 items-center justify-center">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 300 300">
          {Array.from({ length: TOTAL_TICKS }).map((_, i) => {
            const angle = (i / TOTAL_TICKS) * 360;
            const isActive = i < activeTicksCount;
            const isLead = i >= activeTicksCount - 8 && i < activeTicksCount;

            let stroke = "rgba(0, 79, 197, 0.15)";
            let strokeWidth = 3;
            if (isActive) {
              if (isLead) {
                stroke = "#ff6e54";
                strokeWidth = 3.5;
              } else {
                stroke = "#004fc5";
                strokeWidth = 3;
              }
            }

            return (
              <line
                key={i}
                x1="150"
                y1="22"
                x2="150"
                y2={isLead ? "46" : "42"}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                transform={`rotate(${angle} 150 150)`}
                className="transition-all duration-150"
              />
            );
          })}
        </svg>
        <div className="flex flex-col items-center justify-center text-center">
          <span className="font-sans text-4xl font-extrabold tracking-tight text-slate-900">
            {progress}%
          </span>
          <span className="mt-1 text-[11px] font-medium lowercase tracking-wider text-slate-400">
            processing
          </span>
        </div>
      </div>
      <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-[#004fc5]">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#004fc5] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#004fc5]" />
        </span>
        {message}
      </p>
    </div>
  );
}
