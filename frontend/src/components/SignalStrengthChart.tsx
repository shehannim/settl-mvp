import { useEffect, useMemo, useRef, useState } from "react";

export interface Signal {
  key: "income_stability" | "payment_behaviour" | "platform_reputation" | "digital_footprint";
  label: string;
  weight: number;
  strength: number;
  tip: string;
}

interface SignalStrengthChartProps {
  signals: Signal[];
  title?: string;
}

const clampStrength = (value: number) => Math.min(1, Math.max(0, value || 0));

export default function SignalStrengthChart({ signals, title = "What's Driving Your Score" }: SignalStrengthChartProps) {
  const initializedDefaultTip = useRef(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const weakestIndex = useMemo(() => {
    if (!signals.length) return -1;
    return signals.reduce((lowestIndex, signal, index, allSignals) => (
      clampStrength(signal.strength) < clampStrength(allSignals[lowestIndex].strength) ? index : lowestIndex
    ), 0);
  }, [signals]);
  const maxWeight = useMemo(() => Math.max(...signals.map((signal) => Math.max(signal.weight, 0)), 1), [signals]);

  useEffect(() => {
    if (signals.length && !initializedDefaultTip.current) {
      setExpandedKey(signals[weakestIndex].key);
      initializedDefaultTip.current = true;
    }
  }, [signals, weakestIndex]);

  if (!signals.length) {
    return <section className="self-start rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)]" aria-label="Loading score signals"><div className="h-5 w-56 animate-pulse rounded bg-slate-200" /><div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" /><div className="mt-7 space-y-5">{["100%", "86%", "58%", "43%"].map((width) => <div key={width} className="mx-auto animate-pulse" style={{ width }}><div className="mb-2 h-4 rounded bg-slate-200" /><div className="h-2.5 rounded-full bg-[#E5E9F2]" /></div>)}</div></section>;
  }

  return <section className="self-start rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)]" aria-labelledby="signal-strength-chart-title"><header><h2 id="signal-strength-chart-title" className="text-lg font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">Longer bars carry more weight in your score. Fill shows how you&apos;re doing.</p></header><div className="mt-7 space-y-3">{signals.map((signal, index) => {
    const strength = clampStrength(signal.strength);
    const isExpanded = expandedKey === signal.key;
    const isWeakest = index === weakestIndex;
    const relativeWidth = Math.max(35, Math.min(100, (Math.max(signal.weight, 0) / maxWeight) * 100));
    return <button key={signal.key} type="button" aria-expanded={isExpanded} aria-controls={`${signal.key}-tip`} onClick={() => setExpandedKey((current) => current === signal.key ? null : signal.key)} className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004FC5] focus-visible:ring-offset-2 ${isWeakest ? "border-l-4 border-amber-400 bg-amber-50/40 pl-2" : "border-l-4 border-transparent"}`}><div className="flex items-center justify-between gap-4"><span className="text-sm font-medium text-slate-800">{signal.label}</span><span className="font-mono text-sm font-semibold text-slate-700">{Math.round(strength * 100)}%</span></div><div className="mx-auto mt-2" style={{ width: `${relativeWidth}%` }}><div className="h-2.5 overflow-hidden rounded-full bg-[#E5E9F2]"><div className="h-full rounded-full bg-[#004FC5] transition-[width] duration-500 ease-out" style={{ width: `${strength * 100}%` }} /></div></div><div id={`${signal.key}-tip`} className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${isExpanded ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}><div className="overflow-hidden"><p className="flex items-start gap-2 pt-1 text-xs leading-5 text-slate-500"><span aria-hidden="true" className="text-[#004FC5]">→</span>{signal.tip}</p></div></div></button>;
  })}</div></section>;
}
