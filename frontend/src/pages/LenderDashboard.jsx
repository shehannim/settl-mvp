import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

const BAND_STYLES = {
  excellent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  good: "bg-blue-50 text-[#004fc5] border-blue-200",
  fair: "bg-amber-50 text-amber-700 border-amber-200",
  weak: "bg-orange-50 text-orange-700 border-orange-200",
  poor: "bg-red-50 text-red-700 border-red-200",
};

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem("lender_session") || "null");
  } catch {
    return null;
  }
}

export default function LenderDashboard({ go }) {
  const [lender] = useState(loadSession);
  const [profile, setProfile] = useState(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [queryError, setQueryError] = useState("");
  const [searching, setSearching] = useState(false);
  const [deciding, setDeciding] = useState(null);
  const [decisionMsg, setDecisionMsg] = useState("");
  // Session-scoped log only — the authoritative trail is the server audit_log.
  const [sessionLog, setSessionLog] = useState([]);

  const lenderToken = lender?.lender_token || "";
  const headers = { Authorization: `Bearer ${lenderToken}` };

  useEffect(() => {
    if (!lenderToken) return;
    axios
      .get(`${API}/api/lender/me`, { headers })
      .then((res) => setProfile(res.data))
      .catch(() => setProfile(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = () => {
    localStorage.removeItem("lender_session");
    go("lender-login");
  };

  const logSession = (entry) => setSessionLog((prev) => [entry, ...prev].slice(0, 20));

  const search = async (e) => {
    e?.preventDefault();
    setQueryError("");
    setDecisionMsg("");
    setResult(null);
    const raw = query.trim();
    if (!raw) return;
    setSearching(true);
    try {
      const res = await axios.get(
        `${API}/api/lender/query/${encodeURIComponent(raw.toUpperCase())}`,
        { headers }
      );
      const d = res.data;
      setResult(d);
      logSession({
        at: new Date().toLocaleString(),
        settl_id: d.settl_id,
        score: d.score,
        verdict: d.meets_threshold ? "MEETS THRESHOLD" : "BELOW THRESHOLD",
      });
    } catch (liveErr) {
      const status = liveErr.response?.status;
      if (status === 404) {
        setQueryError(`No applicant found for “${raw}”. Check the Settl ID — the borrower must exist, be KYC-verified, and have a computed score.`);
      } else if (status === 403) {
        setQueryError("Applicant identity not verified yet — no score available for this Settl ID.");
      } else if (status === 401) {
        setQueryError("Lender session expired. Please sign in again.");
      } else {
        setQueryError(liveErr.response?.data?.detail || "Lookup failed. Please try again.");
      }
    } finally {
      setSearching(false);
    }
  };

  const decide = async (decision) => {
    if (!result) return;
    setDeciding(decision);
    setDecisionMsg("");
    try {
      const res = await axios.post(
        `${API}/api/lender/outcome`,
        {
          user_id: result.user_id,
          score_at_decision: result.score,
          confidence_at_decision: result.confidence,
          model_version: result.model_version,
          decision,
          repayment_status: "pending",
        },
        { headers }
      );
      setDecisionMsg(
        decision === "approved"
          ? "Approval recorded for the model feedback loop."
          : "Decline recorded for the model feedback loop."
      );
      logSession({
        at: new Date().toLocaleString(),
        settl_id: result.settl_id,
        score: result.score,
        verdict: `${decision === "approved" ? "APPROVED" : "DECLINED"} · ${res.data?.total_labelled_outcomes ?? "?"} labelled outcomes`,
      });
    } catch (liveErr) {
      setDecisionMsg(liveErr.response?.data?.detail || "Could not record the decision.");
    } finally {
      setDeciding(null);
    }
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

  const institution = profile?.institution_name || lender?.email || "Lender";
  const minScore = profile?.min_score ?? 650;
  const minConf = profile?.min_confidence ?? 0.6;

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#f8f9ff] px-4 py-6 text-slate-900 sm:px-6 lg:px-8 font-sans">
      <main className="mx-auto max-w-[1180px] space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Lender Portal
            </span>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{institution}</h1>
            <p className="mt-1 text-sm text-slate-500">{profile?.email || lender?.email || ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-bold text-[#004fc5]">
              Min score {minScore}
            </span>
            <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-bold text-[#004fc5]">
              Min confidence {Math.round(minConf * 100)}%
            </span>
            <button onClick={signOut} className="rounded-full border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
              Sign out
            </button>
          </div>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)]">
          <span className="font-bold text-slate-800">Data boundary: </span>
          lenders see score, confidence and explanations only — raw transactions, utility bills and identity
          documents never leave the borrower vault. Lender retains the final credit decision.
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)]">
          <h2 className="text-base font-bold">Query applicant score</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Look up by Settl ID. The borrower must exist, be KYC-verified, and have a computed score.
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
                  <p className="text-lg font-extrabold">{result.applicant_name}</p>
                  <p className="font-mono text-xs text-slate-500">
                    {result.settl_id}
                    {result.email ? ` · ${result.email}` : ""}
                    {` · ${result.kyc_verified ? "KYC verified" : "KYC pending"}`}
                    {` · ${result.model_version} · scored ${result.scored_at}`}
                  </p>
                </div>
                {verdictBadge(result.meets_threshold ? "MEETS THRESHOLD" : "BELOW THRESHOLD")}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <span className="font-mono text-5xl font-extrabold tracking-tight">{result.score}</span>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${BAND_STYLES[result.band] || BAND_STYLES.fair}`}>
                  {result.band}
                </span>
                <span className="text-sm font-bold text-slate-700">Confidence {Math.round(result.confidence * 100)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-[#004fc5]" style={{ width: `${Math.round(result.confidence * 100)}%` }} />
              </div>
              {(result.top_positive_factors?.length > 0 || result.top_negative_factors?.length > 0) && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-2">Supporting factors</p>
                    <div className="space-y-2">
                      {(result.top_positive_factors || []).map((f, i) => (
                        <div key={i} className="rounded-xl bg-white border border-slate-100 p-3">
                          <p className="text-xs font-bold">{f.display_label} <span className="font-mono text-emerald-600">+{f.shap_value}</span></p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{f.reason_code}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-2">Risk factors</p>
                    <div className="space-y-2">
                      {(result.top_negative_factors || []).map((f, i) => (
                        <div key={i} className="rounded-xl bg-white border border-slate-100 p-3">
                          <p className="text-xs font-bold">{f.display_label} <span className="font-mono text-red-600">{f.shap_value}</span></p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{f.reason_code}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2.5">
                <button onClick={() => decide("approved")} disabled={deciding} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                  {deciding === "approved" ? "Recording…" : "Record approval"}
                </button>
                <button onClick={() => decide("declined")} disabled={deciding} className="rounded-xl border border-red-200 bg-white px-5 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60">
                  {deciding === "declined" ? "Recording…" : "Record decline"}
                </button>
              </div>
              {decisionMsg && (
                <p className="mt-3 text-xs font-semibold text-slate-600">{decisionMsg}</p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)]">
          <h2 className="text-base font-bold">Session activity</h2>
          <p className="mt-0.5 text-xs text-slate-500">Lookups and decisions made in this session. The authoritative trail is the server audit log.</p>
          {sessionLog.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400 font-semibold uppercase tracking-widest">No queries yet this session</p>
          ) : (
            <div className="mt-3 space-y-2">
              {sessionLog.map((e, i) => (
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
