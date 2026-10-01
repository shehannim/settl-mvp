import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { DEMO_FLOW } from "../data/demoFlow.js";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

const formatLkr = (amount) => `LKR ${new Intl.NumberFormat("en-LK").format(amount)}`;
const formatCompact = (value) => `${Math.round(value / 1000)}k`;

function monthLabel(ym) {
  const [y, m] = String(ym).split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const i = parseInt(m, 10) - 1;
  return `${names[i] || m} ${String(y).slice(2)}`;
}

export default function IncomeVsExpensesCard() {
  const [overview, setOverview] = useState({ income: [], expenses: [] });

  useEffect(() => {
    const authToken = localStorage.getItem("token");
    if (!authToken) return;
    const headers = { Authorization: `Bearer ${authToken}` };
    axios
      .get(`${API}/api/connect/income/overview`, { headers })
      .then((res) => setOverview({ income: res.data?.income || [], expenses: res.data?.expenses || [] }))
      .catch(() => setOverview({ income: [], expenses: [] }));
  }, []);

  const flow = useMemo(() => {
    const byMonth = {};
    (overview.income || []).forEach((src) => {
      (src.monthly || []).forEach((p) => {
        const m = String(p.m || "").slice(0, 7);
        if (!m) return;
        byMonth[m] = byMonth[m] || { m, income: 0, expenses: 0, estimated: false };
        byMonth[m].income += Number(p.v) || 0;
        if (src.estimated) byMonth[m].estimated = true;
      });
    });
    (overview.expenses || []).forEach((p) => {
      const m = String(p.m || "").slice(0, 7);
      if (!m) return;
      byMonth[m] = byMonth[m] || { m, income: 0, expenses: 0, estimated: false };
      byMonth[m].expenses += Number(p.v) || 0;
    });
    const liveFlow = Object.values(byMonth).sort((a, b) => (a.m < b.m ? -1 : 1)).slice(-12);
    return liveFlow.length > 0 ? liveFlow : DEMO_FLOW;
  }, [overview]);

  const flowChart = useMemo(() => {
    if (!flow.length) return null;
    const W = 640;
    const H = 260;
    const padL = 52;
    const padR = 20;
    const padT = 20;
    const padB = 34;
    const all = [...flow.map((p) => p.income), ...flow.map((p) => p.expenses)];
    const rawStep = (Math.max(...all) - Math.min(...all)) / 4 || 10000;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const step = [1, 2, 5, 10].map((m) => m * mag).find((m) => m >= rawStep) || rawStep;
    const lo = Math.floor(Math.min(...all) / step) * step;
    const hi = Math.max(Math.ceil(Math.max(...all) / step) * step, lo + step);
    const span = hi - lo;
    const n = flow.length;
    const xOf = (i) => padL + (n === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1));
    const yOf = (v) => padT + (1 - (v - lo) / span) * (H - padT - padB);
    const smooth = (vals) => {
      const P = vals.map((v, i) => ({ x: xOf(i), y: yOf(v) }));
      let d = `M ${P[0].x.toFixed(1)},${P[0].y.toFixed(1)}`;
      for (let i = 0; i < P.length - 1; i++) {
        const p0 = P[Math.max(0, i - 1)];
        const p1 = P[i];
        const p2 = P[i + 1];
        const p3 = P[Math.min(P.length - 1, i + 2)];
        const c1x = (p1.x + (p2.x - p0.x) / 6).toFixed(1);
        const c1y = (p1.y + (p2.y - p0.y) / 6).toFixed(1);
        const c2x = (p2.x - (p3.x - p1.x) / 6).toFixed(1);
        const c2y = (p2.y - (p3.y - p1.y) / 6).toFixed(1);
        d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
      }
      return d;
    };
    return {
      width: W,
      height: H,
      padL,
      padB,
      ticks: Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => ({ value: lo + i * step, y: yOf(lo + i * step) })),
      incomePath: smooth(flow.map((p) => p.income)),
      expensePath: smooth(flow.map((p) => p.expenses)),
      pts: flow.map((p, i) => ({ x: xOf(i), yInc: yOf(p.income), yExp: yOf(p.expenses), p })),
    };
  }, [flow]);

  const latestMonth = flow.length ? flow[flow.length - 1] : null;
  const monthlyNet = latestMonth ? latestMonth.income - latestMonth.expenses : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)] lg:col-span-12">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-bold">Income vs expenses</h2>
          <p className="mt-1 text-xs text-slate-500">Monthly income against utility bills and source fees.</p>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#004fc5]">
          {latestMonth ? `${monthLabel(latestMonth.m)} · net ${monthlyNet != null ? formatLkr(Math.round(monthlyNet)) : "—"}` : "No cashflow"}
        </span>
      </div>
      {!flowChart ? (
        <div className="mt-4 flex min-h-[120px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
          <p className="text-xs text-slate-500">Connect an income source or upload a utility bill to draw this chart.</p>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <svg viewBox={`0 0 ${flowChart.width} ${flowChart.height}`} className="w-full" role="img" aria-label="Monthly income versus expenses chart">
            <defs>
              <linearGradient id="incomeAreaDash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#004fc5" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#004fc5" stopOpacity="0" />
              </linearGradient>
            </defs>
            {flowChart.ticks.map((tick) => (
              <g key={tick.value}>
                <line x1={flowChart.padL} x2={flowChart.width - 20} y1={tick.y} y2={tick.y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
                <text x={flowChart.padL - 10} y={tick.y + 4} textAnchor="end" className="fill-slate-400" fontSize="11" fontWeight="600">
                  {formatCompact(tick.value)}
                </text>
              </g>
            ))}
            <path d={`${flowChart.incomePath} L ${flowChart.pts[flowChart.pts.length - 1].x},${flowChart.height - flowChart.padB} L ${flowChart.pts[0].x},${flowChart.height - flowChart.padB} Z`} fill="url(#incomeAreaDash)" />
            <path d={flowChart.expensePath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d={flowChart.incomePath} fill="none" stroke="#004fc5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {flowChart.pts.map((point) => (
              <g key={point.p.m}>
                <circle cx={point.x} cy={point.yInc} r="4" fill="#ffffff" stroke="#004fc5" strokeWidth="3" />
                <circle cx={point.x} cy={point.yExp} r="3.5" fill="#ffffff" stroke="#f59e0b" strokeWidth="2.5" />
                <text x={point.x} y={flowChart.height - 10} textAnchor="middle" className="fill-slate-500" fontSize="11" fontWeight="600">
                  {monthLabel(point.p.m)}
                </text>
              </g>
            ))}
          </svg>
          <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Values in LKR thousands</span>
            <span>Blue income · amber expenses</span>
          </div>
          {latestMonth?.expense_items?.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {latestMonth.expense_items.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs">
                  <span className="text-slate-500">{item.label}</span>
                  <span className="font-mono font-bold text-slate-800">{formatLkr(item.v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
