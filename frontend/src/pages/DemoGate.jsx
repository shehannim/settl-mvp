import { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

const BAND_STYLES = {
  excellent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  good: "bg-blue-50 text-[#004fc5] border-blue-200",
  fair: "bg-amber-50 text-amber-700 border-amber-200",
  weak: "bg-orange-50 text-orange-700 border-orange-200",
  poor: "bg-red-50 text-red-700 border-red-200",
};

// Public booth landing: one QR opens this page, the judge picks a borrower
// and walks straight into their live profile. Profiles + entry come from the
// backend (/api/demo/*, dummy domain only) — nothing is hardcoded here.
export default function DemoGate({ go, onAuthenticated }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get(`${API}/api/auth/demo/profiles`)
      .then((res) => setProfiles(res.data?.profiles || []))
      .catch(() => setError("Could not reach the demo backend. Is it awake?"))
      .finally(() => setLoading(false));
  }, []);

  const enter = async (key) => {
    setEntering(key);
    setError("");
    try {
      const res = await axios.post(`${API}/api/auth/demo/enter`, { key });
      onAuthenticated({
        accessToken: res.data.access_token,
        id: res.data.user_id,
        email: res.data.email || "",
        name: res.data.name || "",
        settlId: res.data.settl_id || "",
        signupMethod: "email",
      });
      go("dashboard");
    } catch {
      setError("Could not open that profile. Try again or scan once more.");
      setEntering(null);
    }
  };

  const exitDemo = () => {
    [
      "token", "userId", "user_id", "email", "name", "picture",
      "settl_id", "auth_provider", "email_verified", "pdpa_consent_granted",
      "kyc_verified", "kyc_status", "current_page",
    ].forEach((key) => {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    });
    go("auth");
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] px-4 py-10 font-sans text-slate-900 sm:px-6 flex items-start justify-center">
      <main className="w-full max-w-[880px]">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#004fc5]">
            Settl · Live demo
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Pick a borrower
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Three live Settl accounts, low to high. Tap one to walk in — no login needed.
          </p>
        </div>

        {loading && (
          <div className="mt-10 flex justify-center">
            <div className="w-10 h-10 border-[3px] border-slate-200 border-t-[#004fc5] rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {profiles.map((p) => (
              <button
                key={p.key}
                onClick={() => enter(p.key)}
                disabled={entering !== null}
                className="text-left rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)] hover:border-[#004fc5] hover:shadow-lg transition disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-4xl font-extrabold tracking-tight">
                    {p.score ?? "—"}
                  </span>
                  {p.band && (
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${BAND_STYLES[p.band] || BAND_STYLES.fair}`}>
                      {p.band}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-base font-extrabold">{p.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {p.confidence != null ? `${Math.round(p.confidence * 100)}% confidence` : "Tap to open live profile →"}
                </p>
                {entering === p.key && (
                  <p className="mt-2 text-xs font-bold text-[#004fc5]">Opening…</p>
                )}
              </button>
            ))}
          </div>
        )}

        {!loading && !error && profiles.length === 0 && (
          <p className="mt-8 text-center text-sm text-slate-500">
            No demo profiles are live right now — ask the booth crew.
          </p>
        )}

        <div className="mt-10 text-center">
          <button
            onClick={exitDemo}
            className="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-xs font-bold text-slate-600 hover:border-[#004fc5] hover:text-[#004fc5] transition"
          >
            Exit demo → Real Settl product
          </button>
          <p className="mt-2 text-[11px] text-slate-400">
            Signs out the demo account and opens the live sign-in.
          </p>
        </div>
      </main>
    </div>
  );
}
