import { useState } from "react";
import { DEMO_PROFILES } from "../data/demoProfiles.js";
import { BAND_STYLES } from "../data/lenderDemo.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// PDPA minimisation: the viewer shows score + basic details only — alias,
// city and occupation. Full names, emails, handles and account numbers in
// the dataset are never rendered.
function aliasOf(identity) {
  const parts = String(identity.name || "").split(" ");
  if (!parts.length) return "Borrower";
  const last = parts.length > 1 ? ` ${parts[parts.length - 1][0]}.` : "";
  return `${parts[0]}${last}`;
}

function TrendChart({ values }) {
  const W = 620;
  const H = 180;
  const padL = 46;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => ({
    x: padL + (i * (W - padL - padR)) / (values.length - 1),
    y: padT + (1 - v / max) * (H - padT - padB),
    v,
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - padB} L${pts[0].x.toFixed(1)},${H - padB} Z`;
  const fmt = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="12-month income trend">
      <defs>
        <linearGradient id="demoArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#004fc5" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#004fc5" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const y = padT + (1 - f) * (H - padT - padB);
        return (
          <g key={f}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
            <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontWeight="600">
              {fmt(max * f)}
            </text>
          </g>
        );
      })}
      <path d={area} fill="url(#demoArea)" />
      <path d={line} fill="none" stroke="#004fc5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i} className="group">
          <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
          <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#004fc5" strokeWidth="2.5" />
          <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#1e293b"
            stroke="#f8fafc" strokeWidth="3" paintOrder="stroke"
            className="opacity-0 group-hover:opacity-100 transition-opacity">
            {fmt(p.v)}
          </text>
          {i % 2 === 0 && (
            <text x={p.x} y={H - 8} textAnchor="middle" fontSize="9.5" fill="#94a3b8" fontWeight="600">
              {MONTHS[i]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function Field({ label, children }) {  return (
    <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl">
      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-bold text-slate-800">{children}</div>
    </div>
  );
}

export default function DemoProfiles({ go }) {
  const [selected, setSelected] = useState(DEMO_PROFILES[0].key);
  const profile = DEMO_PROFILES.find((p) => p.key === selected) || DEMO_PROFILES[0];
  const exp = profile.expected_score;

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#f8f9ff] px-4 py-6 text-slate-900 sm:px-6 lg:px-8 font-sans">
      <main className="mx-auto max-w-[1180px] space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Borrower personas · Sample data
            </span>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Borrower spectrum</h1>
            <p className="mt-1 text-sm text-slate-500">One engine, full spectrum — pick a persona to walk through.</p>
            <p className="mt-2 inline-block rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
              Anonymized sample data · scores + basic details only
            </p>
          </div>
          {go && (
            <button onClick={() => go("auth")}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              ← Back to sign-in
            </button>
          )}
        </header>

        {/* Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DEMO_PROFILES.map((p) => (
            <button key={p.key} onClick={() => setSelected(p.key)}
              className={`text-left rounded-2xl border p-5 transition shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)] ${
                p.key === selected ? "border-[#004fc5] bg-white ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-slate-300"
              }`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-3xl font-extrabold">{p.expected_score.score}</span>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${BAND_STYLES[p.expected_score.band]}`}>
                  {p.expected_score.band}
                </span>
              </div>
              <p className="mt-2 text-sm font-bold">{aliasOf(p.identity)}</p>
              <p className="text-xs text-slate-500">{p.label} · {p.identity.city}</p>
            </button>
          ))}
        </div>

        {/* Detail */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold">{aliasOf(profile.identity)}</h2>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">{profile.identity.settl_id} · {profile.identity.city}</p>
              <p className="text-sm text-slate-600 mt-1">{profile.identity.occupation}</p>
            </div>
            <div className="text-right">
              <div className="font-mono text-5xl font-extrabold tracking-tight">{exp.score}</div>
              <div className="mt-1 flex items-center justify-end gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${BAND_STYLES[exp.band]}`}>{exp.band}</span>
                <span className="text-xs font-bold text-slate-600">{Math.round(exp.confidence * 100)}% confidence</span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-4">{profile.public_summary}</p>

          <h3 className="mt-6 text-[11px] font-bold uppercase tracking-widest text-slate-400">12-month income (LKR)</h3>
          <div className="mt-2 rounded-xl border border-slate-100 bg-white p-3">
            <TrendChart values={profile.monthly_lkr_12m} />
          </div>

          <h3 className="mt-6 text-[11px] font-bold uppercase tracking-widest text-slate-400">Income sources</h3>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
            {profile.income_sources.map((s, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-sm font-bold">{s.platform} <span className="text-xs font-medium text-slate-500">· {s.level}</span></p>
                <p className="text-xs text-slate-500 mt-0.5">via {s.connected_via}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Field label="Avg / mo">LKR {s.monthly_avg_lkr.toLocaleString()}</Field>
                  <Field label="Tenure">{s.tenure_months} mo</Field>
                  <Field label="Txns (12m)">{s.transactions_12m}</Field>
                  <Field label="On-time">{Math.round(s.on_time_payout_rate * 100)}%</Field>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">{s.note}</p>
              </div>
            ))}
          </div>

          <h3 className="mt-6 text-[11px] font-bold uppercase tracking-widest text-slate-400">Bills & payment behavior</h3>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {profile.bills.map((bill, i) => (
              <div key={i} className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{bill.biller}</div>
                <div className="text-sm font-bold text-slate-800">
                  {bill.ontime_rate == null ? "Not attributable" : `${Math.round(bill.ontime_rate * 100)}% on-time · ${bill.months} mo`}
                </div>
                {bill.account && bill.account !== "—" && (
                  <div className="font-mono text-[11px] text-slate-500 mt-0.5">{bill.account}</div>
                )}
                {bill.note && <div className="text-[11px] text-slate-500 mt-0.5">{bill.note}</div>}
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-2">Supporting factors</p>
              <div className="space-y-2">
                {exp.top_positive_factors.map((f, i) => (
                  <div key={i} className="rounded-xl bg-white border border-slate-100 p-3 text-xs font-semibold">{f}</div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-2">Risk factors</p>
              <div className="space-y-2">
                {exp.top_negative_factors.map((f, i) => (
                  <div key={i} className="rounded-xl bg-white border border-slate-100 p-3 text-xs font-semibold">{f}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-blue-50/60 border border-blue-100 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#004fc5] mb-1">Lender verdict</p>
            <p className="text-sm font-semibold text-slate-800">{exp.verdict}</p>
            <div className="mt-2 space-y-1">
              {exp.improvement_tips.map((t, i) => (
                <p key={i} className="text-xs text-slate-600">→ {t}</p>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
