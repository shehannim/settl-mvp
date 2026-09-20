import { useEffect, useState } from "react";
import axios from "axios";
import paypalLogo from "../assets/paypal.png";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

const demoSource = {
  id: "paypal-demo",
  name: "PayPal Business",
  account: "damidu.design@paypal",
  transactions: 84,
  monthlyIncome: 248500,
  lastSync: "Today, 10:42 AM",
  isDemo: true,
};

const monthlyIncome = [
  { month: "Apr", amount: 182000 },
  { month: "May", amount: 214000 },
  { month: "Jun", amount: 198000 },
  { month: "Jul", amount: 239000 },
  { month: "Aug", amount: 226000 },
  { month: "Sep", amount: 248500 },
];

const recentPayouts = [
  {
    client: "Northstar Studio",
    date: "Today",
    amount: 48200,
    status: "Completed",
  },
  {
    client: "Ceylon Commerce",
    date: "14 Sep",
    amount: 31750,
    status: "Completed",
  },
  {
    client: "Horizon Labs",
    date: "11 Sep",
    amount: 66500,
    status: "Completed",
  },
  {
    client: "Paper & Pixel",
    date: "08 Sep",
    amount: 28400,
    status: "Completed",
  },
];

const formatLkr = (amount) =>
  `LKR ${new Intl.NumberFormat("en-LK").format(amount)}`;

const formatCompact = (value) => `${Math.round(value / 1000)}k`;

/* Builds a smooth (Catmull-Rom → Bézier) line + area path for trend points. */
function buildTrendGeometry(values, width = 640, height = 260) {
  const padL = 52;
  const padR = 20;
  const padT = 20;
  const padB = 34;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const step = Math.max(10000, Math.ceil((dataMax - dataMin) / 4 / 10000) * 10000);
  const min = Math.floor(dataMin / step) * step;
  const max = Math.ceil(dataMax / step) * step;
  const span = Math.max(max - min, 1);

  const points = values.map((v, i) => ({
    x: Math.round((padL + (i * innerW) / (values.length - 1)) * 10) / 10,
    y: Math.round((padT + (1 - (v - min) / span) * innerH) * 10) / 10,
    value: v,
  }));

  let line = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = Math.round((p1.x + (p2.x - p0.x) / 6) * 10) / 10;
    const c1y = Math.round((p1.y + (p2.y - p0.y) / 6) * 10) / 10;
    const c2x = Math.round((p2.x - (p3.x - p1.x) / 6) * 10) / 10;
    const c2y = Math.round((p2.y - (p3.y - p1.y) / 6) * 10) / 10;
    line += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  const area = `${line} L ${points[points.length - 1].x},${height - padB} L ${points[0].x},${height - padB} Z`;

  const ticks = [];
  for (let v = min; v <= max + step / 2; v += step) {
    ticks.push({
      value: v,
      y: Math.round((padT + (1 - (v - min) / span) * innerH) * 10) / 10,
    });
  }

  return { points, line, area, ticks, padL, padB, width, height };
}

export default function PayPalDashboard({ go }) {
  const [realSources, setRealSources] = useState([]);

  useEffect(() => {
    const authToken = localStorage.getItem("token");
    if (!authToken) return;
    axios
      .get(`${API}/api/connect/sources`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      .then((res) => setRealSources(res.data?.sources || []))
      .catch((err) => console.error("Failed to load sources", err));
  }, []);

  const SOURCE_LABELS = {
    paypal: "PayPal Business",
    payoneer: "Payoneer Payouts",
    upwork: "Upwork Contracts",
    fiverr: "Fiverr Revenue",
  };
  const liveSources = realSources.map((s) => ({
    id: s.source,
    name: SOURCE_LABELS[s.source] || s.source,
    account: s.account_name || "Connected Account",
    transactions: s.transaction_count || 0,
    monthlyIncome: s.monthly_avg_lkr || null,
    lastSync: s.connected_at ? new Date(s.connected_at).toLocaleDateString() : "Just now",
    isDemo: !!s.is_demo,
    type: s.source,
  }));

  const hasLiveData = liveSources.length > 0;
  const allDemo = hasLiveData && liveSources.every((s) => s.isDemo);
  const displayedSources = hasLiveData ? liveSources : [demoSource];
  // Hero metric: prefer live backend estimates, fall back to demo preview.
  const liveMonthlyTotal = liveSources.reduce((t, s) => t + (s.monthlyIncome || 0), 0);
  const heroMonthly = hasLiveData && liveMonthlyTotal > 0 ? liveMonthlyTotal : demoSource.monthlyIncome;
  const hasPaypal = realSources.some((s) => s.source === "paypal");
  const hasPayoneer = realSources.some((s) => s.source === "payoneer");
  const hasUpwork = realSources.some((s) => s.source === "upwork");
  const hasFiverr = realSources.some((s) => s.source === "fiverr");
  const trend = buildTrendGeometry(monthlyIncome.map((item) => item.amount));
  const peakValue = Math.max(...monthlyIncome.map((item) => item.amount));
  const totalTransactions = displayedSources.reduce(
    (total, source) => total + source.transactions,
    0,
  );
  const averageMonthlyIncome = Math.round(
    monthlyIncome.reduce((total, item) => total + item.amount, 0) /
      monthlyIncome.length,
  );

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
            {hasLiveData ? (allDemo ? "Demo preview" : "Live data") : "Demo data"}
          </span>
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
            label="Monthly income"
            value={formatLkr(heroMonthly)}
            detail={hasLiveData && liveMonthlyTotal > 0 ? "Live estimate across sources" : "September estimate"}
          />
          <MetricCard
            label="Average monthly income"
            value={formatLkr(averageMonthlyIncome)}
            detail="Last six months"
          />
          <MetricCard
            label="Verified transactions"
            value={String(totalTransactions)}
            detail="Across connected sources"
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
                {displayedSources.length} source
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {displayedSources.map((source) => (
                <div
                  key={source.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white">
                      {source.type === "payoneer" ? (
                        <span className="flex h-full w-full items-center justify-center bg-[#ff4800] text-base font-extrabold text-white">
                          Py
                        </span>
                      ) : source.type === "upwork" ? (
                        <span className="flex h-full w-full items-center justify-center bg-[#14a800] text-base font-extrabold text-white">
                          Up
                        </span>
                      ) : source.type === "fiverr" ? (
                        <span className="flex h-full w-full items-center justify-center bg-[#00b22d] text-base font-extrabold text-white">
                          Fi
                        </span>
                      ) : (
                        <img
                          src={paypalLogo}
                          alt="PayPal"
                          className="h-full w-full object-contain p-1.5"
                        />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold">
                          {source.name}
                        </p>
                        {source.isDemo && (
                          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-[#004fc5]">
                            Sample
                          </span>
                        )}
                      </div>
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
                        This month
                      </p>
                      <p className="mt-1 font-mono text-sm font-bold text-slate-800">
                        {source.monthlyIncome != null
                          ? formatLkr(source.monthlyIncome)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Last synced
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
                <h2 className="text-base font-bold">Income trend</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Monthly earnings over the last six months.
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-[#004fc5]">
                +17% from April
              </span>
            </div>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <svg
                viewBox={`0 0 ${trend.width} ${trend.height}`}
                className="w-full"
                role="img"
                aria-label="Monthly income trend line chart"
              >
                <defs>
                  <linearGradient id="incomeArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#004fc5" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#004fc5" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Gridlines + axis labels */}
                {trend.ticks.map((tick) => (
                  <g key={tick.value}>
                    <line
                      x1={trend.padL}
                      x2={trend.width - 20}
                      y1={tick.y}
                      y2={tick.y}
                      stroke="#e2e8f0"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={trend.padL - 10}
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

                {/* Area + trend line */}
                <path d={trend.area} fill="url(#incomeArea)" />
                <path
                  d={trend.line}
                  fill="none"
                  stroke="#004fc5"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data points with hover values */}
                {trend.points.map((point, i) => {
                  const isPeak = monthlyIncome[i].amount === peakValue;
                  const isLast = i === trend.points.length - 1;
                  return (
                    <g key={monthlyIncome[i].month} className="group">
                      <circle cx={point.x} cy={point.y} r="14" fill="transparent" />
                      {isPeak && (
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="9"
                          fill="none"
                          stroke="#004fc5"
                          strokeOpacity="0.3"
                          strokeWidth="2"
                        />
                      )}
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={isLast ? 5.5 : 4}
                        fill="#ffffff"
                        stroke="#004fc5"
                        strokeWidth="3"
                      />
                      <text
                        x={point.x}
                        y={point.y - 14}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        className={`fill-slate-800 transition-opacity ${
                          isLast ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                        stroke="#f8fafc"
                        strokeWidth="3"
                        paintOrder="stroke"
                      >
                        {formatCompact(point.value)}k
                      </text>
                      <text
                        x={point.x}
                        y={trend.height - 10}
                        textAnchor="middle"
                        className="fill-slate-500"
                        fontSize="11"
                        fontWeight="600"
                      >
                        {monthlyIncome[i].month}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <span>Values in LKR thousands</span>
                <span>Hover points for exact amounts</span>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold">Recent income activity</h2>
              <p className="mt-1 text-xs text-slate-500">
                {allDemo
                  ? "Demo payouts seeded from your sandbox connect — matches the scoring input."
                  : "Sample payout activity used to preview this view."}
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-[#004fc5]">
              {formatLkr(
                recentPayouts.reduce((total, item) => total + item.amount, 0),
              )}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {recentPayouts.map((payout) => (
              <div
                key={`${payout.client}-${payout.date}`}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {payout.client}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {payout.date} · PayPal payout
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-slate-800">
                    +{formatLkr(payout.amount)}
                  </p>
                  <p className="mt-0.5 text-[10px] font-bold text-emerald-600">
                    {payout.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
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
