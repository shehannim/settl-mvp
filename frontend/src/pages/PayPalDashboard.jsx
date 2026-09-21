import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import paypalLogo from "../assets/paypal.png";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

const formatLkr = (amount) =>
  `LKR ${new Intl.NumberFormat("en-LK").format(amount)}`;

const formatCompact = (value) => `${Math.round(value / 1000)}k`;

/* Builds a smooth (Catmull-Rom → Bézier) line + area path for trend points. */
function buildTrendGeometry(values, labels, width = 640, height = 260) {
  const padL = 52;
  const padR = 20;
  const padT = 20;
  const padB = 34;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const rawStep = (dataMax - dataMin) / 4 || 1;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((m) => m >= rawStep) || rawStep;
  const min = Math.floor(dataMin / step) * step;
  const max = Math.ceil(dataMax / step) * step;
  const span = Math.max(max - min, 1);

  const points = values.map((v, i) => ({
    x: Math.round((padL + (values.length === 1 ? innerW / 2 : (i * innerW) / (values.length - 1))) * 10) / 10,
    y: Math.round((padT + (1 - (v - min) / span) * innerH) * 10) / 10,
    value: v,
    label: labels[i] || "",
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

const SOURCE_META = {
  paypal: { name: "PayPal Business" },
  payoneer: { name: "Payoneer Payouts" },
  upwork: { name: "Upwork Contracts" },
  fiverr: { name: "Fiverr Revenue" },
};

function SourceIcon({ type }) {
  if (type === "payoneer") {
    return (
      <span className="flex h-full w-full items-center justify-center bg-[#ff4800] text-base font-extrabold text-white">
        Py
      </span>
    );
  }
  if (type === "upwork") {
    return (
      <span className="flex h-full w-full items-center justify-center bg-[#14a800] text-base font-extrabold text-white">
        Up
      </span>
    );
  }
  if (type === "fiverr") {
    return (
      <span className="flex h-full w-full items-center justify-center bg-[#00b22d] text-base font-extrabold text-white">
        Fi
      </span>
    );
  }
  return <img src={paypalLogo} alt="PayPal" className="h-full w-full object-contain p-1.5" />;
}

export default function PayPalDashboard({ go }) {
  const [realSources, setRealSources] = useState([]);
  const [history, setHistory] = useState([]);
  const [latestScore, setLatestScore] = useState(null);
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
      .get(`${API}/api/score/history`, { headers })
      .then((res) => setHistory(res.data?.history || []))
      .catch(() => setHistory([]));
    axios
      .get(`${API}/api/score/result`, { headers })
      .then((res) => setLatestScore(res.data))
      .catch(() => setLatestScore(null));
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
  const totalTransactions = useMemo(
    () => liveSources.reduce((acc, curr) => acc + curr.transactions, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(liveSources.map((s) => s.transactions))]
  );

  const trendPoints = useMemo(() => {
    const rows = [...history]
      .filter((h) => h.score != null && h.computed_at)
      .sort((a, b) => new Date(a.computed_at) - new Date(b.computed_at))
      .slice(-12);
    return rows.map((h) => ({
      value: h.score,
      label: new Date(h.computed_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    }));
  }, [history]);

  const trend = trendPoints.length >= 2
    ? buildTrendGeometry(trendPoints.map((p) => p.value), trendPoints.map((p) => p.label))
    : null;
  const peakValue = trendPoints.length ? Math.max(...trendPoints.map((p) => p.value)) : 0;

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
                <h2 className="text-base font-bold">Score trend</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Your Settl score across recalibrations.
                </p>
              </div>
              {trend && (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-[#004fc5]">
                  {trendPoints.length} snapshots
                </span>
              )}
            </div>
            {!trend ? (
              <div className="mt-6 flex min-h-[220px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                <div>
                  <p className="text-sm font-semibold text-slate-700">No trend yet</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Recalibrate at least twice — each computation adds a snapshot to this chart.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <svg
                  viewBox={`0 0 ${trend.width} ${trend.height}`}
                  className="w-full"
                  role="img"
                  aria-label="Settl score trend line chart"
                >
                  <defs>
                    <linearGradient id="incomeArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#004fc5" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#004fc5" stopOpacity="0" />
                    </linearGradient>
                  </defs>

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
                        {Math.round(tick.value)}
                      </text>
                    </g>
                  ))}

                  <path d={trend.area} fill="url(#incomeArea)" />
                  <path
                    d={trend.line}
                    fill="none"
                    stroke="#004fc5"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {trend.points.map((point, i) => {
                    const isPeak = point.value === peakValue;
                    const isLast = i === trend.points.length - 1;
                    return (
                      <g key={`${point.label}-${i}`} className="group">
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
                          {point.value}
                        </text>
                        <text
                          x={point.x}
                          y={trend.height - 10}
                          textAnchor="middle"
                          className="fill-slate-500"
                          fontSize="11"
                          fontWeight="600"
                        >
                          {point.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <span>Settl score (300–850)</span>
                  <span>Hover points for exact scores</span>
                </div>
              </div>
            )}
          </article>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold">Score history</h2>
              <p className="mt-1 text-xs text-slate-500">
                Every recalibration, newest first.
              </p>
            </div>
          </div>
          {history.length === 0 ? (
            <div className="mt-4 flex min-h-[120px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
              <p className="text-xs text-slate-500">
                No snapshots yet — recalibrate your score to start the history.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {[...history].reverse().slice(0, 10).map((h, i) => (
                <div
                  key={`${h.computed_at}-${i}`}
                  className="flex items-center justify-between gap-4 py-3.5"
                >
                  <div>
                    <p className="font-mono text-sm font-bold text-slate-800">
                      {h.score} <span className="text-[10px] uppercase text-slate-400">{h.band}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {h.computed_at ? new Date(h.computed_at).toLocaleString() : ""}
                    </p>
                  </div>
                  <p className="font-mono text-xs font-bold text-[#004fc5]">
                    {h.confidence != null ? `${Math.round(h.confidence * 100)}% conf` : ""}
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
