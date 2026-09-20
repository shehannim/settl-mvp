import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import cebLogo from "../assets/ceylon-electricity-board-logo-png_seeklogo-226257.png";
import sltLogo from "../assets/SLT.png";
import dialogLogo from "../assets/png-clipart-dialog-axiata-axiata-group-xl-axiata-colombo-dialog-broadband-networks-dialog-axiata-angle-rectangle.png";
import paypalLogo from "../assets/paypal.png";
import ScoreHeroCard from "../components/ScoreHeroCard.jsx";
import CalibratingDial from "../components/CalibratingDial.jsx";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

export default function Dashboard({ token, go }) {
  const [score, setScore] = useState(null);
  const [sources, setSources] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [settlId, setSettlId] = useState(() => localStorage.getItem("settl_id") || "");
  const [copied, setCopied] = useState(false);
  const [showCollapsedScore, setShowCollapsedScore] = useState(false);
  const heroRef = useRef(null);
  const [billStatus] = useState(() => localStorage.getItem("utility_bill_review_status") || "");
  const kycVerified = localStorage.getItem("kyc_verified") === "true";
  const authToken = token || localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${authToken}` };
  const paypal = sources.find((source) => source.source === "paypal");
  const payoneer = sources.find((source) => source.source === "payoneer");

  const [sessionExpired, setSessionExpired] = useState(false);

  const loadSources = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/connect/sources`, { headers: { Authorization: `Bearer ${authToken}` } });
      setSources(response.data.sources || []);
      setSessionExpired(false);
    } catch (requestError) {
      // An expired/invalid token yields an empty list — say so instead of
      // silently showing every source as "Not connected".
      if (requestError.response?.status === 401) setSessionExpired(true);
      else console.error("Failed to load sources", requestError);
    }
  }, [authToken]);

  const [computing, setComputing] = useState(false);
  const autoComputedRef = useRef(false);

  const loadScore = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/score/result`, { headers: { Authorization: `Bearer ${authToken}` } });
      setScore(response.data);
      return true;
    } catch (requestError) {
      // A new profile has no saved score yet; the hero shows the thin-file state.
      if (requestError.response?.status !== 404) console.error("Failed to load score", requestError);
      return false;
    }
  }, [authToken]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      // Unique Settl ID for the lender portal (backfills sessions from before it was stored).
      if (!localStorage.getItem("settl_id")) {
        try {
          const me = await axios.get(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${authToken}` } });
          if (me.data?.settl_id && !cancelled) {
            localStorage.setItem("settl_id", me.data.settl_id);
            setSettlId(me.data.settl_id);
          }
        } catch { /* demo/SSO tokens have no profile — keep CTA hidden-safe */ }
      }
      await loadSources();
      const found = await loadScore();
      // No score yet but sources connected (e.g. fresh PayPal connect):
      // compute once so the dashboard shows a score instead of nothing.
      // 403 (KYC) / 422 (insufficient data) stay in the no-score CTA state.
      if (!found && !cancelled && !autoComputedRef.current) {
        autoComputedRef.current = true;
        try {
          const src = await axios.get(`${API}/api/connect/sources`, { headers: { Authorization: `Bearer ${authToken}` } });
          if ((src.data?.sources || []).length > 0) {
            setComputing(true);
            await axios.post(`${API}/api/score/compute`, {}, { headers: { Authorization: `Bearer ${authToken}` } });
            await loadScore();
          }
        } catch {
          // Keep the thin-file CTA visible.
        } finally {
          if (!cancelled) setComputing(false);
        }
      }
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [loadScore, loadSources, authToken]);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setShowCollapsedScore(!entry.isIntersecting),
      { rootMargin: "-72px 0px 0px 0px", threshold: 0 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  const syncPaypal = async () => { setSyncing(true); try { const response = await axios.post(`${API}/api/score/compute`, {}, { headers }); setScore(response.data); await loadSources(); } finally { setSyncing(false); } };
  // No fake baseline: a fresh account has NO score until /api/score/compute
  // succeeds (min 300 on the 300–850 scale). Never render a hardcoded 745.
  const hasScore = score?.score != null;
  const scoreValue = score?.score ?? null;
  const scoreBand = ({ poor: "Poor", weak: "Fair", fair: "Fair", good: "Good", "very good": "Very Good", excellent: "Excellent" })[String(score?.band || "").toLowerCase()] || null;
  const scoreConfidence = score?.confidence ?? null;
  const verification = kycVerified ? "verified" : billStatus === "needs_review" ? "needs_review" : "pending";
  const improvementTip = score?.improvement_tips?.[0]?.body || (paypal || payoneer ? undefined : "Connect a verified income source to strengthen your score");
  const incomeRows = [
    paypal
      ? { name: "PayPal income", detail: `${paypal.transaction_count || 0} transactions analyzed`, amount: paypal.account_name || "Connected", status: "Active", logo: paypalLogo, alt: "PayPal", connected: true, connectPage: "paypal-connect" }
      : { name: "PayPal income", detail: "Connect a verified income stream", amount: "Not connected", status: "Connect", logo: paypalLogo, alt: "PayPal", connected: false, connectPage: "paypal-connect" },
    payoneer
      ? { name: "Payoneer income", detail: `${payoneer.transaction_count || 0} transactions analyzed`, amount: payoneer.account_name || "Connected", status: "Active", logo: null, alt: "Payoneer", connected: true, connectPage: "payoneer-connect" }
      : { name: "Payoneer income", detail: "Connect a verified income stream", amount: "Not connected", status: "Connect", logo: null, alt: "Payoneer", connected: false, connectPage: "payoneer-connect" },
  ];
  const sourceRows = incomeRows;
  const bills = [{ name: "CEB Electricity", amount: "Upload to verify", logo: cebLogo }, { name: "SLT Fibre Broadband", amount: "Upload to verify", logo: sltLogo }, { name: "Dialog Postpaid", amount: "Upload to verify", logo: dialogLogo }];

  return <div className="min-h-[calc(100vh-72px)] bg-[#f8f9ff] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">{showCollapsedScore && hasScore && <div className="fixed left-1/2 top-[84px] z-20 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:w-[420px]"><ScoreHeroCard score={scoreValue} band={scoreBand} confidence={scoreConfidence} verification={verification} collapsed /></div>}<main className="mx-auto max-w-[1180px]"><header className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Credit Score Insights</h1></div>{kycVerified ? <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#004fc5]">Verified identity</span> : <button onClick={() => go("kyc")} className="rounded-full bg-[#004fc5] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#003a94]">Verify identity</button>}</header>
    {sessionExpired && (
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5">
        <p className="min-w-0 flex-1 text-sm font-semibold text-red-700">
          Session expired — your connections and score can&apos;t load until you sign in again.
        </p>
        <button
          onClick={() => go("auth")}
          className="rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
        >
          Sign in again
        </button>
      </div>
    )}
    {settlId && (
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#004fc5]">Your Settl ID — give this to lenders</p>
          <p className="mt-0.5 truncate font-mono text-base font-extrabold tracking-tight text-slate-900">{settlId}</p>
        </div>
        <button
          onClick={() => {
            try { navigator.clipboard.writeText(settlId); } catch { /* clipboard unavailable */ }
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-bold text-[#004fc5] hover:bg-blue-50"
        >
          {copied ? "Copied ✓" : "Copy ID"}
        </button>
      </div>
    )}
    <section ref={heroRef}>
      {hasScore ? (
        <>
          {String(score?.model_version || "").startsWith("demo") && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-xs font-semibold text-amber-700">
              Initial score from your connected accounts. Add more sources and recalibrate to raise it.
            </div>
          )}
          <ScoreHeroCard score={scoreValue} band={scoreBand} confidence={scoreConfidence} verification={verification} improvementTip={improvementTip} />
        </>
      ) : computing ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-[0_20px_55px_rgba(0,79,197,0.08)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Your Settl Score</p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
            Calibrating your score...
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            We found your connected income — generating your first score now.
          </p>
          <CalibratingDial message="Analyzing income signals..." />
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-[0_20px_55px_rgba(0,79,197,0.08)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Your Settl Score</p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
            No score yet — build yours from 300
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {!kycVerified
              ? "Scores range 300–850. Identity verification is required before your first score — verify, then recalibrate."
              : "Scores range 300–850 and grow as you add verified income and repayment signals. Connect at least one income source, then recalibrate."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {!kycVerified ? (
              <button onClick={() => go("kyc")} className="rounded-full bg-[#004fc5] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#003a94]">
                Verify identity →
              </button>
            ) : (
              <button onClick={() => go("income-streams")} className="rounded-full bg-[#004fc5] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#003a94]">
                Connect income →
              </button>
            )}
            <button onClick={() => go("score-calibration")} className="rounded-full border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
              Recalibrate score
            </button>
          </div>
        </div>
      )}
    </section>
    <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)] lg:col-span-6"><SectionTitle title="Connected Income Sources" subtitle="Aggregated income signals and consistency" />{sourceRows.map((row) => <div key={row.name} className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white">{row.logo ? <img src={row.logo} alt={row.alt} className="h-full w-full object-contain p-1.5" /> : <span className="flex h-full w-full items-center justify-center bg-[#ff4800] text-sm font-extrabold text-white">P</span>}</span><div className="min-w-0"><p className="truncate text-sm font-bold">{row.name} <span className="ml-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] text-[#004fc5]">{row.status}</span></p><p className="truncate text-[11px] text-slate-400">{row.detail}</p></div></div>{row.connected ? <button onClick={syncPaypal} disabled={syncing} className="rounded-full border border-blue-200 px-3 py-1.5 text-xs font-bold text-[#004fc5] hover:bg-blue-50">{syncing ? "Syncing…" : "Sync"}</button> : <button onClick={() => go(row.connectPage)} className="rounded-full bg-[#004fc5] px-3 py-1.5 text-xs font-bold text-white">Connect</button>}</div>)}<button onClick={() => go("paypal-dashboard")} className="mt-4 text-xs font-bold text-[#004fc5] hover:underline">View all streams →</button></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)] lg:col-span-6"><SectionTitle title="Latest Utility Bills" subtitle="Repayment signals calibrated for score weight" action="Upload bill" onClick={() => go("bill-upload")} />{bills.map((bill) => <div key={bill.name} className="mt-2.5 flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white"><img src={bill.logo} alt="" className="h-full w-full object-contain p-1" /></span><div><p className="text-xs font-bold">{bill.name}</p><p className="text-[10px] text-slate-400">{billStatus === "verified" ? "Verified repayment signal" : bill.amount}</p></div></div><span className="text-[10px] font-bold text-[#004fc5]">{billStatus === "verified" ? "Verified" : "Pending"}</span></div>)}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><span className="text-xs text-slate-500">View other utility bills</span><button onClick={() => go("paypal-dashboard")} className="rounded-full bg-[#004fc5] px-4 py-2 text-xs font-bold text-white">View income sources</button></div></div></section>
  </main></div>;
}

function SectionTitle({ title, subtitle, action, onClick }) { return <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3"><div><h2 className="text-base font-bold">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{subtitle}</p></div><button onClick={onClick} className="shrink-0 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#004fc5] hover:bg-blue-100">{action}</button></div>; }
