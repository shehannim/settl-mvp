
/**
 * @param {{
 *   value: number;
 *   min?: number;
 *   max?: number;
 *   segments?: number;
 *   heightClass?: string;
 *   showLabels?: boolean;
 *   showMidpoint?: boolean;
 *   formatLabel?: (val: number) => string;
 *   className?: string;
 *   ariaLabel?: string;
 * }} props
 */
export default function ScoreSegmentedBar({
  value,
  min = 350,
  max = 850,
  segments = 24,
  heightClass = "h-14",
  showLabels = true,
  showMidpoint = true,
  formatLabel = (val) => String(Math.round(val)),
  className = "",
  ariaLabel = "Segmented progress readout",
}) {
  const numericValue = Number(value) || 0;
  const clampedValue = Math.min(max, Math.max(min, numericValue));
  const range = max - min;
  const ratio = range > 0 ? (clampedValue - min) / range : 0;
  const filledCount = Math.round(ratio * segments);
  const midpoint = (min + max) / 2;

  return (
    <div className={`w-full ${className}`}>
      {/* Segmented bar track */}
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={numericValue}
        aria-valuemin={min}
        aria-valuemax={max}
        className={`flex w-full items-center gap-1 sm:gap-1.5 ${heightClass}`}
      >
        {Array.from({ length: segments }, (_, index) => {
          const isFilled = index < filledCount;
          return (
            <div
              key={index}
              className={`h-full flex-1 rounded-full transition-colors duration-300 ${
                isFilled
                  ? "bg-white shadow-[0_0_6px_rgba(255,255,255,0.3)]"
                  : "bg-white/25"
              }`}
            />
          );
        })}
      </div>

      {/* Range labels */}
      {showLabels && (
        <div className="mt-2 flex items-center justify-between font-mono text-xs text-blue-100/70">
          <span>{formatLabel(min)}</span>
          {showMidpoint && (
            <span className="text-[11px] text-blue-100/50">{formatLabel(midpoint)}</span>
          )}
          <span>{formatLabel(max)}</span>
        </div>
      )}
    </div>
  );
}
