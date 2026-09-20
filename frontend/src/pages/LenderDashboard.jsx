import { useMemo, useState } from "react";
import axios from "axios";
import {
  DEMO_APPLICANTS,
  BAND_STYLES,
  meetsThreshold,
} from "../data/lenderDemo.js";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem("lender_session") || "null");
  } catch {
    return null;
  }
}

function loadAudit() {
  try {
    return JSON.parse(localStorage.getItem("lender_audit") || "[]");
  } catch {
    return [];
  }
}

export default function LenderDashboard({ go }) {
  const [lender] = useState(loadSession);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [queryError, setQueryError] = useState("");
  const [searching, setSearching] = useState(false);
  const [audit, setAudit] = useState(loadAudit);

  const signOut = () => {
    localStorage.removeItem("lender_session");
    go("lender-login");
  };

  const recordAudit = (applicant, verdict) => {
    const entry = {
      at: new Date().toLocaleString(),
      institution: lender.institution,
      settl_id: applicant.settl_id,
      score: applicant.score,
      verdict,
    };
    const next = [entry, ...audit].slice(0, 20);
    setAudit(next);
    localStorage.setItem("lender_audit", JSON.stringify(next));
  };

  const searchDemoBook = () => {
    const id = query.trim().toUpperCase();
    return (
      DEMO_APPLICANTS.find((a) => a.settl_id.toUpperCase() === id) ||
      DEMO_APPLICANTS.find((a) => a.applicant_name.toLowerCase().includes(query.trim().toLowerCase()))
    );
  };

  const search = async (e) => {
    e?.preventDefault();
    setQueryError("");
    setResult(null);
    const raw = query.trim();
    if (!raw) return;

    // Live lookup first when signed in with a live lender account —
    // this finds real borrowers (e.g. demo walkthrough accounts).
    if (lender?.lender_token) {
      setSearching(true);
      try {
        const res = await axios.get(
          `${API}/api/lender/query/${encodeURIComponent(raw.toUpperCase())}`,
          { headers: { Authorization: `Bearer ${lender.lender_token}` } }
        );
        const d = res.data;
        const applicant = {
          settl_id: d.settl_id,
          applicant_name: d.applicant_name,
          email: d.email,
          kyc_verified: d.kyc_verified,
          score: d.score,
          band: d.band,
          confidence: d.confidence,
          model_version: d.model_version,
          scored_at: d.scored_at,
          sources: "live",
          live: true,
        };
        const verdict = d.meets_threshold ? "MEETS THRESHOLD" : "BELOW THRESHOLD";
        setResult({ applicant, verdict });
        recordAudit(applicant, verdict);
        return;
      } catch (liveErr) {
        const status = liveErr.response?.status;
        if (status === 404) {
          setQueryError(`No live applicant found for “${raw}”. Check the Settl ID or try the demo book below.`);
          return;
        }
        if (status === 403) {
          setQueryError("Applicant identity not verified yet — no score available for this Settl ID.");
          return;
        }
        // Network/backend down → fall through to the demo book.
      } finally {
        setSearching(false);
      }
    }

    const found = searchDemoBook();
    if (!found) {
      setQueryError(`No applicant found for “${raw}”. Try a Settl ID from the book below.`);
      return;
    }
    const verdict = meetsThreshold(found, lender) ? "MEETS THRESHOLD" : "BELOW THRESHOLD";
    setResult({ applicant: found, verdict });
    recordAudit(found, verdict);
  };

  const decide = (applicant, decision) => {
    recordAudit(applicant, decision === "approve" ? "APPROVED (demo)" : "DECLINED (demo)");
  };

  const verdictBadge = useMemo(() => (verdict) => {
    const ok = verdict === "MEETS THRESHOLD";
    return (
      <span className={`inline-block rounded-full border px-3 py-1 text-xs font-bold ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
        {verdict}
      </span>
    );
  }, []);

  if (!lender) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-[#f8f9ff] px-4 py-10 flex items-start justify-center font-sans">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-extrabold">Lender session required</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in with a lender account first.</p>
          <button onClick={() => go("lender-login")} className="mt-5 w-full rounded-xl bg-[#004fc5] py-3 text-sm font-bold text-white hover:bg-[#003a94]">
            Go to lender sign-in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#f8f9ff] px-4 py-6 text-slate-900 sm:px-6 lg:px-8 font-sans">
      <main className="mx-auto max-w-[1180px] space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Lender Portal · Demo data
            </span>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{lender.institution}</h1>
            <p className="mt-1 text-sm text-slate-500">{lender.officer} · {lender.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-bold text-[#004fc5]">
              Min score {lender.min_score}
            </span>
            <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-bold text-[#004fc5]">
              Min confidence {Math.round(lender.min_confidence * 100)}%
            </span>
            <button onClick={signOut} className="rounded-full border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
              Sign out
            </button>
          </div>
        </header>

        {/* Data boundary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)]">
          <span className="font-bold text-slate-800">Data boundary: </span>
          lenders see the applicant&apos;s score, name and basic identity only — raw transactions, utility bills and identity
          documents never leave the borrower vault. Lender retains the final credit decision.
        </div>

        {/* Query */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)]">
          <h2 className="text-base font-bold">Query applicant score</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Look up by Settl ID (e.g. STL-2026-A41F9C){lender?.live ? " — live borrower lookup" : " or applicant name"}.
          </p>
          <form onSubmit={search} className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="STL-2026-…"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm font-semibold outline-none focus:border-[#004fc5] focus:ring-4 focus:ring-blue-100"
            />
            <button type="submit" disabled={searching} className="rounded-xl bg-[#004fc5] px-6 py-3 text-sm font-bold text-white hover:bg-[#003a94] disabled:opacity-60">
              {searching ? "Querying…" : "Query score"}
            </button>
          </form>
          {queryError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{queryError}</div>
          )}

          {result && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-extrabold">{result.applicant.applicant_name}</p>
                  <p className="font-mono text-xs text-slate-500">
                    {result.applicant.settl_id}
                    {result.applicant.email ? ` · ${result.applicant.email}` : ""}
                    {result.applicant.live && result.applicant.kyc_verified !== undefined
                      ? ` · ${result.applicant.kyc_verified ? "KYC verified" : "KYC pending"}`
                      : ` · ${result.applicant.sources} sources`}
                    {` · ${result.applicant.model_version} · scored ${result.applicant.scored_at}`}
                  </p>
                </div>
                {verdictBadge(result.verdict)}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <span className="font-mono text-5xl font-extrabold tracking-tight">{result.applicant.score}</span>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${BAND_STYLES[result.applicant.band]}`}>
                  {result.applicant.band}
                </span>
                <span className="text-sm font-bold text-slate-700">Confidence {Math.round(result.applicant.confidence * 100)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-[#004fc5]" style={{ width: `${Math.round(result.applicant.confidence * 100)}%` }} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <button onClick={() => decide(result.applicant, "approve")} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700">
                  Record approval (demo)
                </button>
                <button onClick={() => decide(result.applicant, "decline")} className="rounded-xl border border-red-200 bg-white px-5 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50">
                  Record decline (demo)
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Applicant book */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)]">
          <h2 className="text-base font-bold">Applicant book</h2>
          <p className="mt-0.5 text-xs text-slate-500">Hardcoded demo pipeline — click a row to query.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pl-2">Applicant</th>
                  <th className="pb-3">Settl ID</th>
                  <th className="pb-3">Score</th>
                  <th className="pb-3">Confidence</th>
                  <th className="pb-3 pr-2 text-right">Threshold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {DEMO_APPLICANTS.map((a) => {
                  const ok = meetsThreshold(a, lender);
                  return (
                    <tr key={a.settl_id} className="hover:bg-slate-50/70 transition-colors cursor-pointer" onClick={() => { setQuery(a.settl_id); setResult({ applicant: a, verdict: ok ? "MEETS THRESHOLD" : "BELOW THRESHOLD" }); recordAudit(a, ok ? "MEETS THRESHOLD" : "BELOW THRESHOLD"); }}>
                      <td className="py-3 pl-2 font-bold text-slate-800">{a.applicant_name}</td>
                      <td className="py-3 font-mono text-slate-600">{a.settl_id}</td>
                      <td className="py-3">
                        <span className="font-mono font-bold">{a.score}</span>{" "}
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${BAND_STYLES[a.band]}`}>{a.band}</span>
                      </td>
                      <td className="py-3 font-mono">{Math.round(a.confidence * 100)}%</td>
                      <td className="py-3 pr-2 text-right">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                          {ok ? "Meets" : "Below"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Audit trail */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)]">
          <h2 className="text-base font-bold">Query audit trail</h2>
          <p className="mt-0.5 text-xs text-slate-500">Every lookup is logged — mirrors the production audit_log table.</p>
          {audit.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400 font-semibold uppercase tracking-widest">No queries yet this session</p>
          ) : (
            <div className="mt-3 space-y-2">
              {audit.map((e, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-xs">
                  <span className="font-mono text-slate-500">{e.at}</span>
                  <span className="font-mono font-bold">{e.settl_id}</span>
                  <span className="font-mono">score {e.score}</span>
                  <span className="font-bold text-[#004fc5]">{e.verdict}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
