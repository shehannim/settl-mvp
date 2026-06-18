import { useState, useEffect } from "react";
import axios from "axios";
import fingerprintLogo from "../assets/fingerprint.png";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

// --- Minimalist SVG Icons ---
const Icons = {
  Wallet: () => (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  ),

  Document: () => (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),

  Trending: () => (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),

  Shield: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),

  Refresh: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 2v6h-6"></path>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
      <path d="M3 22v-6h6"></path>
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
    </svg>
  ),

  Trash: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  ),

  Plus: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  ),
};

export default function Dashboard({ token, userId, go }) {
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [error, setError] = useState("");

  const [syncingId, setSyncingId] = useState(null);
  const [disconnectingId, setDisconnectingId] = useState(null);

  const [file, setFile] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [sources, setSources] = useState([]);

  // Profile verification data from bill upload
  const [profileVerificationScore, setProfileVerificationScore] = useState(
    Number(localStorage.getItem("profile_verification_score") || 0)
  );
  const [utilityBillReviewStatus, setUtilityBillReviewStatus] = useState(
    localStorage.getItem("utility_bill_review_status") || ""
  );
  const [utilityBillNameMatchScore, setUtilityBillNameMatchScore] = useState(
    Number(localStorage.getItem("utility_bill_name_match_score") || 0)
  );

  // ✅ NEW: frontend-only KYC verification state
  const [kycVerified, setKycVerified] = useState(
    localStorage.getItem("kyc_verified") === "true"
  );

  const authToken = token || localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${authToken}` };

  useEffect(() => {
  const refreshDashboardState = async () => {
    await loadSources();
    loadStoredVerificationState();

    const verified = localStorage.getItem("kyc_verified") === "true";
    setKycVerified(verified);

    const refreshFlag = localStorage.getItem("profile_score_refresh");
    if (refreshFlag === "1") {
      localStorage.removeItem("profile_score_refresh");
    }

    const paypalRefresh = localStorage.getItem("paypal_refresh");
    if (paypalRefresh === "1") {
      localStorage.removeItem("paypal_refresh");
    }
  };

  refreshDashboardState();

  const handleFocus = () => {
    refreshDashboardState();
  };

  const handleVisibility = () => {
    if (!document.hidden) {
      refreshDashboardState();
    }
  };

  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}, []);

  const loadStoredVerificationState = () => {
    const storedScore = Number(localStorage.getItem("profile_verification_score") || 0);
    const storedReviewStatus = localStorage.getItem("utility_bill_review_status") || "";
    const storedMatchScore = Number(localStorage.getItem("utility_bill_name_match_score") || 0);

    setProfileVerificationScore(storedScore);
    setUtilityBillReviewStatus(storedReviewStatus);
    setUtilityBillNameMatchScore(storedMatchScore);
  };

  const loadSources = async () => {
    setSourcesLoading(true);
    try {
      const res = await axios.get(`${API}/api/connect/sources`, { headers });
      setSources(res.data.sources || []);
    } catch (e) {
      console.error("Failed to load sources", e);
    }
    setSourcesLoading(false);
  };

  const paypal = sources.find((s) => s.source === "paypal");

  const handleSyncSource = async (sourceId) => {
    setSyncingId(sourceId);
    try {
      await axios.post(`${API}/api/score/compute`, {}, { headers });
      await loadSources();
    } catch (err) {
      console.error("Sync failed", err);
    }
    setSyncingId(null);
  };

  const handleDisconnectSource = async (sourceId) => {
    if (!window.confirm("Are you sure you want to disconnect this income source?")) return;

    setDisconnectingId(sourceId);
    try {
      await axios.delete(`${API}/api/connect/${sourceId}`, { headers });
      setSources(sources.filter((s) => s.source !== sourceId));
    } catch (err) {
      console.error("Disconnect failed", err);
    }
    setDisconnectingId(null);
  };

  const computeScore = async () => {
    setLoading(true);
    setError("");
    try {
      await axios.post(`${API}/api/score/compute`, {}, { headers });
      const res = await axios.get(`${API}/api/score/result`, { headers });
      setScore(res.data);
    } catch (e) {
      console.error("Score error:", e);
      setError(e.response?.data?.detail || "Could not compute score");
    }
    setLoading(false);
  };

  const uploadBill = async () => {
    if (!file) return;
    setUploading(true);
    setError("");

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await axios.post(`${API}/api/ingest/utility-bill`, form, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });

      setOcrResult(res.data);

      if (res.data?.profile_verification_score !== undefined) {
        setProfileVerificationScore(res.data.profile_verification_score);
        localStorage.setItem(
          "profile_verification_score",
          String(res.data.profile_verification_score)
        );
      }

      if (res.data?.status) {
        setUtilityBillReviewStatus(res.data.status);
        localStorage.setItem("utility_bill_review_status", res.data.status);
      }

      if (res.data?.identity_match_score !== undefined) {
        setUtilityBillNameMatchScore(res.data.identity_match_score);
        localStorage.setItem(
          "utility_bill_name_match_score",
          String(res.data.identity_match_score)
        );
      }

      localStorage.setItem("profile_score_refresh", "1");
    } catch (e) {
      setError(e.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const profileCompletion = () => {
    let completed = 0;

    if (paypal) completed += 35;
    if (utilityBillReviewStatus === "verified") completed += 35;
    if (score) completed += 30;

    return completed;
  };

  const completion = profileCompletion();

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-slate-50 relative overflow-hidden font-sans text-slate-800 p-4 md:p-8 flex items-start justify-center">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-200/40 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-indigo-200/30 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-[1280px] bg-white/70 backdrop-blur-2xl border border-white/90 shadow-[0_4px_40px_-10px_rgba(0,0,0,0.05)] rounded-[2rem] p-8 md:p-12 overflow-hidden flex flex-col gap-10">
        
        {/* Header with logo */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden p-2">
              <img
                src={fingerprintLogo}
                alt="Settl Logo"
                className="w-full h-full object-contain"
              />
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Settl Dashboard
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                Profile Verification Overview
              </div>
            </div>
          </div>

          {/* ✅ Get Verified button moved from navbar */}
          {kycVerified ? (
            <button
              disabled
              className="px-5 py-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold cursor-default"
            >
              Verified
            </button>
          ) : (
            <button
              onClick={() => go && go("kyc")}
              className="px-5 py-3 rounded-xl bg-black text-white font-semibold hover:bg-slate-800 transition"
            >
              Get Verified
            </button>
          )}
        </div>

        {/* Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* Left: Score Overview */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold uppercase tracking-widest mb-4">
              <span>Financial Profile</span>
              <span className="text-slate-300">•</span>
              <span className="text-blue-600">Overview</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6">
              {score ? "Credit Profile" : "Welcome Back"}
            </h1>

            {/* Status Pills */}
            <div className="flex flex-wrap gap-3 mb-8">
              <div className="px-3 py-1.5 bg-white/80 rounded-lg border border-slate-200/60 text-xs font-semibold text-slate-700 flex items-center gap-2 shadow-sm">
                <span
                  className={`w-2 h-2 rounded-full ${
                    paypal
                      ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                      : "bg-slate-300"
                  }`}
                ></span>
                PayPal: {paypal ? "Active" : "Pending"}
              </div>

              <div className="px-3 py-1.5 bg-white/80 rounded-lg border border-slate-200/60 text-xs font-semibold text-slate-700 flex items-center gap-2 shadow-sm">
                <span
                  className={`w-2 h-2 rounded-full ${
                    utilityBillReviewStatus === "verified"
                      ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                      : utilityBillReviewStatus === "needs_staff_review"
                      ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                      : "bg-slate-300"
                  }`}
                ></span>
                Utility Data:{" "}
                {utilityBillReviewStatus === "verified"
                  ? "Verified"
                  : utilityBillReviewStatus === "needs_staff_review"
                  ? "Needs Staff Review"
                  : "Pending"}
              </div>
            </div>

            {/* Main Score Display */}
            <div className="mt-4">
              <div className="text-7xl md:text-8xl font-light tracking-tighter text-slate-900 mb-2 font-mono">
                {score ? score.score : <span className="text-slate-300">---</span>}
              </div>
              <div className="text-sm font-medium text-slate-500 flex items-center gap-3">
                Calculated Settl Score
                {score && (
                  <span className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-[10px] uppercase tracking-widest font-bold shadow-sm">
                    {score.band}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Top Stats */}
          <div className="flex flex-col">
            <div className="grid grid-cols-3 gap-4 mb-8 bg-white/50 p-4 rounded-2xl border border-white/80 shadow-sm">
              <TopStat
                label="Confidence"
                value={score ? `${(score.confidence * 100).toFixed(0)}%` : "0%"}
              />
              <TopStat label="Active Sources" value={sources.length} />
              <TopStat label="Profile Score" value={profileVerificationScore} highlight />
            </div>

            {/* Completion Arc */}
            <div className="flex-1 flex flex-col items-center justify-center relative pt-4">
              <div className="relative w-64 h-32 overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 100 50">
                  <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray="125.6"
                    strokeDashoffset={125.6 - (125.6 * completion) / 100}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center text-center">
                  <span className="text-3xl font-bold text-slate-900 font-mono">
                    {completion}%
                  </span>
                  <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mt-1">
                    Profile Verified
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mt-4">
          
          {/* Left: Data Sources */}
          <div className="lg:col-span-3 bg-white/50 backdrop-blur-md rounded-3xl border border-slate-200/60 p-6 md:p-8 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-slate-900 tracking-tight">
                Data Sources & Analysis
              </h3>
            </div>

            <div className="space-y-4">
              {/* PayPal card */}
              <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 shadow-sm transition hover:border-slate-300 group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-50 text-slate-700 rounded-xl flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    <Icons.Wallet />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">
                      PayPal Integration
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {paypal
                        ? `Active · ${paypal.transaction_count || 0} transactions analyzed`
                        : "Pending Authorization"}
                    </div>
                  </div>
                </div>

                {!paypal ? (
                  <button
                    onClick={() => go && go("paypal-connect")}
                    className="px-5 py-2 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-slate-800 transition shadow-sm"
                  >
                    Connect
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSyncSource("paypal")}
                      disabled={syncingId === "paypal"}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-bold uppercase tracking-widest rounded-md transition-colors"
                    >
                      <div className={syncingId === "paypal" ? "animate-spin text-blue-600" : ""}>
                        <Icons.Refresh />
                      </div>
                      Sync
                    </button>

                    <button
                      onClick={() => handleDisconnectSource("paypal")}
                      disabled={disconnectingId === "paypal"}
                      className="p-1.5 border border-transparent text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100 rounded-md transition-colors"
                      title="Disconnect PayPal"
                    >
                      {disconnectingId === "paypal" ? (
                        <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-0.5"></div>
                      ) : (
                        <Icons.Trash />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Utility bill status card */}
              <div className="flex flex-col p-4 bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition hover:border-slate-300 group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 text-slate-700 rounded-xl flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      <Icons.Document />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">
                        Utility Bill Verification
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {utilityBillReviewStatus === "verified"
                          ? "Verified automatically"
                          : utilityBillReviewStatus === "needs_staff_review"
                          ? "Waiting for staff review"
                          : "Awaiting document upload"}
                      </div>
                    </div>
                  </div>

                  {utilityBillReviewStatus === "verified" && (
                    <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded-md">
                      <Icons.Shield /> Verified
                    </span>
                  )}

                  {utilityBillReviewStatus === "needs_staff_review" && (
                    <span className="flex items-center gap-1 text-amber-600 text-[10px] font-bold uppercase tracking-wider bg-amber-50 px-2 py-1 rounded-md">
                      <Icons.Shield /> Staff Review
                    </span>
                  )}
                </div>

                {utilityBillReviewStatus && (
                  <div className="mt-2 ml-16 grid grid-cols-2 gap-y-3 gap-x-4 border-t border-slate-100 pt-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        Review Status
                      </span>
                      <span className="text-sm font-medium text-slate-800 truncate mt-0.5">
                        {utilityBillReviewStatus}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        Name Match Score
                      </span>
                      <span className="text-sm font-medium text-slate-800 truncate mt-0.5">
                        {utilityBillNameMatchScore || 0}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        Profile Verification Score
                      </span>
                      <span className="text-sm font-medium text-slate-800 truncate mt-0.5">
                        {profileVerificationScore}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Quick Operations */}
          <div className="lg:col-span-2 bg-[#0b132b] p-6 md:p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none -translate-y-1/2 translate-x-1/4"></div>

            <div>
              <div className="flex justify-between items-center mb-8 relative z-10">
                <h3 className="font-semibold text-white tracking-tight">
                  Quick Actions
                </h3>
              </div>

              <div className="space-y-5 relative z-10">
                {/* Upload Action */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">
                    Step 1: Utility Document
                  </div>

                  <input
                    id="billInput"
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files[0])}
                  />

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => document.getElementById("billInput").click()}
                      className="w-full bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium py-3 rounded-xl transition truncate px-4 text-left flex justify-between items-center"
                    >
                      {file ? file.name : "Select PDF Document..."}
                      <span className="text-slate-500 text-xs border border-slate-600 rounded px-2 py-0.5">
                        Browse
                      </span>
                    </button>

                    <button
                      onClick={uploadBill}
                      disabled={!file || uploading}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-bold tracking-wide py-3 rounded-xl transition mt-1"
                    >
                      {uploading ? "Extracting Data..." : "Run Extraction"}
                    </button>
                  </div>

                  {error && (
                    <div className="text-red-400 text-xs mt-3 font-medium bg-red-400/10 p-2 rounded">
                      {error}
                    </div>
                  )}
                </div>

                {/* Calculate Action */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">
                    Step 2: Generate Engine
                  </div>

                  <button
                    onClick={computeScore}
                    disabled={loading}
                    className="w-full bg-white text-slate-900 font-bold tracking-wide py-3.5 rounded-xl hover:bg-slate-100 transition disabled:opacity-70 flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                  >
                    {loading ? "Processing Algebra..." : "Calculate Final Score"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-semibold uppercase tracking-widest mt-8 relative z-10 border-t border-white/10 pt-4">
              <Icons.Shield />
              Powered by Settl Engine
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopStat({ label, value, highlight }) {
  return (
    <div className="flex flex-col border-l-2 border-slate-200/60 pl-3">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
        {label}
      </span>
      <span
        className={`text-xl font-bold tracking-tight font-mono ${
          highlight ? "text-emerald-600" : "text-slate-800"
        }`}
      >
        {value}
      </span>
    </div>
  );
}