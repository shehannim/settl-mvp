import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { DEMO_CUSTOMERS, searchDemoCustomers } from "../data/demoCustomers.js";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

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
  // Demo customer directory (offline walkthrough data, clearly labelled).
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [selectedDemoId, setSelectedDemoId] = useState(null);

  const lenderToken = lender?.lender_token || "";
  const headers = { Authorization: `Bearer ${lenderToken}` };
  const thresholdScore = profile?.min_score ?? lender?.min_score ?? 650;
  const thresholdConf = profile?.min_confidence ?? lender?.min_confidence ?? 0.6;

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
    const demoHit = DEMO_CUSTOMERS.find(
      (c) => c.settl_id.toUpperCase() === raw.toUpperCase(),
    );
    // Demo sessions search the seeded directory directly; live sessions still
    // try the backend first, then fall back to the searchable demo records.
    if (!lenderToken || lender?.demo) {
      setSearching(false);
      if (demoHit) {
        const verdict = demoHit.score >= thresholdScore && demoHit.confidence >= thresholdConf
          ? "MEETS THRESHOLD"
          : "BELOW THRESHOLD";
        setResult({ ...demoHit, user_id: `demo-${demoHit.settl_id}`, meets_threshold: demoHit.score >= thresholdScore && demoHit.confidence >= thresholdConf });
        logSession({
          at: new Date().toLocaleString(),
          settl_id: demoHit.settl_id,
          score: demoHit.score,
          verdict,
        });
        setQueryError("Showing demo customer record — live lookup is disabled in demo mode.");
      } else {
        setQueryError(`No demo account found for “${raw}”. Search demo customer IDs below or enter a live lender account.`);
      }
      return;
    }
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
        if (demoHit) {
          setResult({ ...demoHit, user_id: `demo-${demoHit.settl_id}`, meets_threshold: demoHit.score >= thresholdScore && demoHit.confidence >= thresholdConf });
          logSession({
            at: new Date().toLocaleString(),
            settl_id: demoHit.settl_id,
            score: demoHit.score,
            verdict: demoHit.score >= thresholdScore && demoHit.confidence >= thresholdConf ? "MEETS THRESHOLD" : "BELOW THRESHOLD",
          });
          setQueryError("Live account not found — showing matching demo customer record.");
          return;
        }
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
    if (!lenderToken || lender?.demo) {
      setDeciding(null);
      setDecisionMsg("Demo mode is read-only — sign in with a live lender account to record outcomes.");
      return;
    }
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

  const demoMatches = useMemo(
    () => searchDemoCustomers(directoryQuery),
    [directoryQuery],
  );
  const selectedDemoCustomer = useMemo(
    () => DEMO_CUSTOMERS.find((c) => c.settl_id === selectedDemoId) || null,
    [selectedDemoId],
  );

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
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="font-mono text-xs font-bold text-slate-500">{result.settl_id}</span>
                {verdictBadge(result.meets_threshold ? "MEETS THRESHOLD" : "BELOW THRESHOLD")}
              </div>
              <div className="mt-4 flex items-center gap-4">
                <span className="font-mono text-5xl font-extrabold tracking-tight">{result.score}</span>
                <span className="text-sm font-bold text-slate-700">Confidence {Math.round(result.confidence * 100)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-[#004fc5]" style={{ width: `${Math.round(result.confidence * 100)}%` }} />
              </div>
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
          <h2 className="text-base font-bold">Demo customer directory</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Offline walkthrough data — search by Settl ID or name, then click a row to inspect score and confidence.
          </p>
          <input
            value={directoryQuery}
            onChange={(e) => setDirectoryQuery(e.target.value)}
            placeholder="Search demo customers by Settl ID or name…"
            className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm font-semibold outline-none focus:border-[#004fc5] focus:ring-4 focus:ring-blue-100"
          />
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100">
            <div className="divide-y divide-slate-100">
              {demoMatches.map((c) => (
                <button
                  key={c.settl_id}
                  onClick={() => setSelectedDemoId(c.settl_id)}
                  className={`flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left text-xs transition ${selectedDemoId === c.settl_id ? "bg-blue-50" : "bg-white hover:bg-slate-50"}`}
                >
                  <span>
                    <span className="block font-bold">{c.applicant_name}</span>
                    <span className="block font-mono text-slate-500">{c.settl_id}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-50 border border-slate-100 px-2.5 py-1 font-mono font-bold">score {c.score}</span>
                    <span className="rounded-full bg-slate-50 border border-slate-100 px-2.5 py-1 font-mono font-bold">{Math.round(c.confidence * 100)}%</span>
                  </span>
                </button>
              ))}
              {demoMatches.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-slate-400 font-semibold uppercase tracking-widest">No demo customers match</p>
              )}
            </div>
          </div>
          {selectedDemoCustomer && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="font-mono text-xs font-bold text-slate-500">{selectedDemoCustomer.settl_id}</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-500">
                {selectedDemoCustomer.band}
              </span>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <span className="font-mono text-5xl font-extrabold tracking-tight">{selectedDemoCustomer.score}</span>
                <span className="text-sm font-bold text-slate-700">Confidence {Math.round(selectedDemoCustomer.confidence * 100)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-[#004fc5]" style={{ width: `${Math.round(selectedDemoCustomer.confidence * 100)}%` }} />
              </div>
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
