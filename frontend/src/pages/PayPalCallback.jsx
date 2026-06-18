import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

// --- Consistent SVGs for the UI States ---
const Icons = {
  Spinner: () => (
    <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin shadow-sm"></div>
  ),
  Success: () => (
    <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-sm">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
  ),
  Error: () => (
    <div className="w-16 h-16 bg-red-50 border border-red-100 text-red-600 rounded-full flex items-center justify-center shadow-sm">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    </div>
  )
};

export default function PayPalCallback({ go }) {
  const [status, setStatus] = useState("processing");
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code) {
      setStatus("error");
      setError("No authorization code received from PayPal.");
      return;
    }

    // ✅ Call YOUR backend callback
    fetch(
      `${API_URL}/api/connect/paypal/callback?code=${code}&state=${state}`
    )
      .then((res) => {
        if (!res.ok) {
          throw new Error("PayPal callback failed");
        }

        // ✅ IMPORTANT: backend redirects, no JSON needed
        setStatus("success");

        // ✅ Redirect to animated success screen
        setTimeout(() => go && go("paypal-success"), 800);
      })
      .catch((err) => {
        console.error(err);
        setStatus("error");
        setError("Failed to establish secure connection with PayPal.");
      });
  }, [go]);

  return (
    // Global Wrapper matching the rest of the application
    <div className="w-full min-h-[calc(100vh-80px)] bg-slate-50 relative overflow-hidden font-sans text-slate-800 p-4 flex items-center justify-center">
      
      {/* Decorative Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-blue-200/40 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Glass Panel */}
      <div className="relative w-full max-w-md bg-white/80 backdrop-blur-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] p-10 text-center flex flex-col items-center">
        
        {/* ✅ PROCESSING STATE */}
        {status === "processing" && (
          <div className="flex flex-col items-center animate-in fade-in duration-500">
            <div className="mb-6">
              <Icons.Spinner />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 mb-2">
              Securing Connection
            </h2>
            <p className="text-sm font-medium text-slate-500">
              Synchronizing telemetry with PayPal...
            </p>
          </div>
        )}

        {/* ✅ SUCCESS STATE */}
        {status === "success" && (
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
            <div className="mb-6">
              <Icons.Success />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 mb-2">
              Pipeline Verified
            </h2>
            <p className="text-sm font-medium text-slate-500">
              Redirecting to your dashboard...
            </p>
          </div>
        )}

        {/* ✅ ERROR STATE */}
        {status === "error" && (
          <div className="flex flex-col items-center animate-in fade-in duration-300 w-full">
            <div className="mb-6">
              <Icons.Error />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 mb-2">
              Connection Failed
            </h2>
            <p className="text-sm font-medium text-red-600 mb-8 bg-red-50 px-4 py-2 rounded-lg border border-red-100 w-full">
              {error}
            </p>
            <button
              onClick={() => go && go("paypal-connect")}
              className="w-full bg-[#0b132b] hover:bg-slate-800 text-white font-bold tracking-wide py-3.5 rounded-xl transition-all shadow-sm"
            >
              Try Again
            </button>
            <button
              onClick={() => go && go("paypal-dashboard")}
              className="w-full text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-colors mt-4 py-2"
            >
              Return to Dashboard
            </button>
          </div>
        )}

      </div>
    </div>
  );
}