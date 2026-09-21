import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import paypalLogo from "../assets/paypal.png";
import payoneerLogo from "../assets/brand-payoneer.svg";
import upworkLogo from "../assets/brand-upwork.svg";
import fiverrLogo from "../assets/brand-fiverr.svg";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

const formatLkr = (amount) =>
  `LKR ${new Intl.NumberFormat("en-LK").format(amount)}`;

const formatCompact = (value) => `${Math.round(value / 1000)}k`;


const SOURCE_META = {
  paypal: { name: "PayPal Business", tile: "#ffffff", img: paypalLogo, pad: true },
  payoneer: { name: "Payoneer Payouts", tile: "#ff4800", img: payoneerLogo },
  upwork: { name: "Upwork Contracts", tile: "#14a800", img: upworkLogo },
  fiverr: { name: "Fiverr Revenue", tile: "#00b22d", img: fiverrLogo },
  linkedin: { name: "LinkedIn Verified", tile: "#0a66c2", letter: "in" },
};

function SourceIcon({ type }) {
  // Bundled brand marks (no runtime hotlinking) with a letter fallback.
  const meta = SOURCE_META[type] || { tile: "#475569", letter: String(type || "?").slice(0, 2) };
  if (!meta.img) {
    return (
      <span className="flex h-full w-full items-center justify-center text-base font-extrabold text-white" style={{ background: meta.tile }}>
        {meta.letter}
      </span>
    );
  }
  return (
    <span className="flex h-full w-full items-center justify-center" style={{ background: meta.tile }}>
      <img src={meta.img} alt={meta.name} className={meta.pad ? "h-full w-full object-contain p-1.5" : "h-3/5 w-3/5 object-contain"} />
    </span>
  );
}

function monthLabel(ym) {
  const [y, m] = String(ym).split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const i = parseInt(m, 10) - 1;
  return `${names[i] || m} ${String(y).slice(2)}`;
}

export default function PayPalDashboard({ go }) {
  const [realSources, setRealSources] = useState([]);
  const [latestScore, setLatestScore] = useState(null);
  const [overview, setOverview] = useState({ income: [], expenses: [] });
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const authToken = localStorage.getItem("token");
    if (!authToken) {
      setSessionExpired(true);
      return;
    }
    const headers = { Authorization: `Bearer ${authToken}` };
    axios
      .get(`${API}/api/connect/sources`, { headers })
      .then((res) => setRealSources(res.data?.sources || []))
      .catch((err) => {
        if (err.response?.status === 401) setSessionExpired(true);
        else console.error("Failed to load sources", err);
      });
    axios
      .get(`${API}/api/score/result`, { headers })
      .then((res) => setLatestScore(res.data))
      .catch(() => setLatestScore(null));
    axios
      .get(`${API}/api/connect/income/overview`, { headers })
      .then((res) => setOverview({
        income: res.data?.income || [],
        expenses: res.data?.expenses || [],
      }))
      .catch(() => setOverview({ income: [], expenses: [] }));
  }, []);

  const liveSources = realSources.map((s) => ({
    id: s.source,
    type: s.source,
    name: SOURCE_META[s.source]?.name || s.source,
    account: s.account_name || "Connected Account",
    transactions: s.transaction_count || 0,
    lastSync: s.connected_at ? new Date(s.connected_at).toLocaleDateString() : "Just now",
  }));

  const hasLiveData = liveSources.length > 0;

  // Income vs expenses, merged across sources by month (live backend rows).
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
    return Object.values(byMonth).sort((a, b) => (a.m < b.m ? -1 : 1)).slice(-12);
  }, [overview]);

  // Dual-series chart on one shared stepped scale (income blue, expenses amber).
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
    // Proper Catmull-Rom → cubic Bézier: distinct control points per side,
    // so curves pass through every month without kinks or overshoot loops.
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
    const incomePath = smooth(flow.map((p) => p.income));
    const expensePath = smooth(flow.map((p) => p.expenses));
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) {
      ticks.push({ value: v, y: yOf(v) });
    }
    return {
      width: W, height: H, padL, padB, ticks,
      incomePath,
      expensePath,
      pts: flow.map((p, i) => ({ x: xOf(i), yInc: yOf(p.income), yExp: yOf(p.expenses), p })),
    };
  }, [flow]);

  const latestMonth = flow.length ? flow[flow.length - 1] : null;
  const monthlyNet = latestMonth ? latestMonth.income - latestMonth.expenses : null;

  const hasPaypal = realSources.some((s) => s.source === "paypal");
  const hasPayoneer = realSources.some((s) => s.source === "payoneer");
  const hasUpwork = realSources.some((s) => s.source === "upwork");
  const hasFiverr = realSources.some((s) => s.source === "fiverr");

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#f8f9ff] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-[1180px]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Your income overview
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              A clear view of the income signals supporting your Settl Score.
            </p>
          </div>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#004fc5]">
            {hasLiveData ? "Live data" : "No sources yet"}
          </span>
          {sessionExpired && (
            <button
              onClick={() => go && go("auth")}
              className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
            >
              Session expired — sign in again
            </button>
          )}
        </header>

        {(!hasPaypal || !hasPayoneer || !hasUpwork || !hasFiverr) && (
          <div className="mt-6 flex flex-wrap gap-3">
            {!hasPaypal && (
              <button
                onClick={() => go && go("paypal-connect")}
                className="rounded-full bg-[#004fc5] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#003a94]"
              >
                Connect PayPal
              </button>
            )}
            {!hasPayoneer && (
              <button
                onClick={() => go && go("payoneer-connect")}
                className="rounded-full bg-[#ff4800] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#d63d00]"
              >
                Connect Payoneer
              </button>
            )}
            {!hasUpwork && (
              <button
                onClick={() => go && go("upwork-connect")}
                className="rounded-full bg-[#14a800] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#108600]"
              >
                Connect Upwork
              </button>
            )}
            {!hasFiverr && (
              <button
                onClick={() => go && go("fiverr-connect")}
                className="rounded-full bg-[#00b22d] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#009325]"
              >
                Connect Fiverr
              </button>
            )}
          </div>
        )}

        <section className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          <MetricCard
            label="Connected sources"
            value={String(liveSources.length)}
            detail={hasLiveData ? "Across verified platforms" : "Connect a source to begin"}
          />
          <MetricCard
            label="Latest Settl score"
            value={latestScore ? String(latestScore.score) : "—"}
            detail={latestScore ? `${latestScore.band} · ${Math.round((latestScore.confidence || 0) * 100)}% confidence` : "No score computed yet"}
          />
          <MetricCard
            label="Monthly net"
            value={monthlyNet != null ? formatLkr(Math.round(monthlyNet)) : "—"}
            detail={latestMonth ? `${monthLabel(latestMonth.m)} · income minus bills` : "Connect a source first"}
          />
        </section>

        <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)] lg:col-span-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold">
                  Connected income sources
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Verified platforms contributing to your profile.
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#004fc5]">
                {liveSources.length} source{liveSources.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {liveSources.length === 0 && (
                <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                    No pipelines linked
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Connect PayPal, Payoneer, Upwork or Fiverr above to feed your score.
                  </p>
                </div>
              )}
              {liveSources.map((source) => (
                <div
                  key={source.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white">
                      <SourceIcon type={source.type} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {source.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {source.account}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                      Active
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200/70 pt-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Transactions
                      </p>
                      <p className="mt-1 font-mono text-sm font-bold text-slate-800">
                        {source.transactions}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Connected
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {source.lastSync}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)] lg:col-span-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Income vs expenses</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Monthly payouts across sources against utility-bill spend.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest">
                <span className="flex items-center gap-1.5 text-[#004fc5]">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#004fc5]" /> Income
                </span>
                <span className="flex items-center gap-1.5 text-amber-600">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> Bills
                </span>
              </div>
            </div>
            {!flowChart ? (
              <div className="mt-6 flex min-h-[220px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                <div>
                  <p className="text-sm font-semibold text-slate-700">No cashflow yet</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Connect an income source or upload a utility bill to draw this chart.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <svg
                  viewBox={`0 0 ${flowChart.width} ${flowChart.height}`}
                  className="w-full"
                  role="img"
                  aria-label="Monthly income versus bill expenses chart"
                >
                  <defs>
                    <linearGradient id="incomeArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#004fc5" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#004fc5" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {flowChart.ticks.map((tick) => (
                    <g key={tick.value}>
                      <line
                        x1={flowChart.padL}
                        x2={flowChart.width - 20}
                        y1={tick.y}
                        y2={tick.y}
                        stroke="#e2e8f0"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={flowChart.padL - 10}
                        y={tick.y + 4}
                        textAnchor="end"
                        className="fill-slate-400"
                        fontSize="11"
                        fontWeight="600"
                      >
                        {formatCompact(tick.value)}
                      </text>
                    </g>
                  ))}

                  <path d={`${flowChart.incomePath} L ${flowChart.pts[flowChart.pts.length - 1].x},${flowChart.height - flowChart.padB} L ${flowChart.pts[0].x},${flowChart.height - flowChart.padB} Z`} fill="url(#incomeArea)" />
                  <path
                    d={flowChart.expensePath}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeDasharray="1 0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={flowChart.incomePath}
                    fill="none"
                    stroke="#004fc5"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {flowChart.pts.map((point, i) => (
                    <g key={point.p.m} className="group">
                      <circle cx={point.x} cy={Math.min(point.yInc ?? point.y, point.yExp ?? point.y)} r="16" fill="transparent" />
                      <circle cx={point.x} cy={point.yInc} r="4" fill="#ffffff" stroke="#004fc5" strokeWidth="3" />
                      <circle cx={point.x} cy={point.yExp} r="3.5" fill="#ffffff" stroke="#f59e0b" strokeWidth="2.5" />
                      <text
                        x={point.x}
                        y={Math.min(point.yInc, point.yExp) - 12}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        className="fill-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                        stroke="#f8fafc"
                        strokeWidth="3"
                        paintOrder="stroke"
                      >
                        {formatCompact(point.p.income)}/{formatCompact(point.p.expenses)}k
                      </text>
                      <text
                        x={point.x}
                        y={flowChart.height - 10}
                        textAnchor="middle"
                        className="fill-slate-500"
                        fontSize="11"
                        fontWeight="600"
                      >
                        {monthLabel(point.p.m)}
                      </text>
                    </g>
                  ))}
                </svg>
                <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <span>Values in LKR thousands · dotted months are declared estimates</span>
                  <span>Hover points for exact amounts</span>
                </div>
              </div>
            )}
          </article>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold">Monthly cashflow</h2>
              <p className="mt-1 text-xs text-slate-500">
                Income in, bills out — newest first.
              </p>
            </div>
          </div>
          {flow.length === 0 ? (
            <div className="mt-4 flex min-h-[120px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
              <p className="text-xs text-slate-500">
                Nothing to tabulate yet — connect income or upload a bill.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {[...flow].reverse().map((row) => (
                <div
                  key={row.m}
                  className="flex items-center justify-between gap-4 py-3.5"
                >
                  <div>
                    <p className="font-mono text-sm font-bold text-slate-800">
                      {monthLabel(row.m)}{" "}
                      <span className="font-mono font-bold text-[#004fc5]">+{formatLkr(Math.round(row.income))}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Bills {formatLkr(Math.round(row.expenses))}
                      {row.estimated ? " · includes declared estimates" : ""}
                    </p>
                  </div>
                  <p className={`font-mono text-xs font-bold ${row.income - row.expenses >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    net {formatLkr(Math.round(row.income - row.expenses))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 font-mono text-xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}
