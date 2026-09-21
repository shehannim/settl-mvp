import { useEffect, useState } from "react";
import axios from "axios";

// DEMO-ONLY auto-login for booth QR codes. Credentials below unlock dummy
// accounts holding synthetic data — never real users. Each QR encodes
// https://<frontend>/#demo=<key> and lands here, already authenticated.
const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

const DEMO_LOGINS = {
  kasun: { email: "kasun.f.demo@settl-demo.com", password: "Demo@1234", label: "Kasun · struggling borrower" },
  sanduni: { email: "sanduni.p.demo@settl-demo.com", password: "Demo@1234", label: "Sanduni · stable borrower" },
  ayesha: { email: "ayesha.r.demo@settl-demo.com", password: "Demo@1234", label: "Ayesha · exceptional borrower" },
};

export default function DemoLogin({ go, onAuthenticated, demoKey }) {
  const [error, setError] = useState("");
  const entry = DEMO_LOGINS[demoKey];

  useEffect(() => {
    if (!entry) {
      setError("Unknown demo profile. Ask the booth for a fresh QR code.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const login = await axios.post(`${API}/api/auth/login`, {
          email: entry.email,
          password: entry.password,
        });
        const headers = { Authorization: `Bearer ${login.data.access_token}` };
        let name = "";
        try {
          const me = await axios.get(`${API}/api/auth/me`, { headers });
          name = me.data?.full_name || "";
        } catch {
          // name stays blank; dashboard still works
        }
        if (cancelled) return;
        onAuthenticated({
          accessToken: login.data.access_token,
          id: login.data.user_id,
          email: entry.email,
          name,
          settlId: login.data.settl_id || "",
          signupMethod: "email",
        });
        go("dashboard");
      } catch {
        if (!cancelled) setError("Demo login failed — is the backend awake? Try the manual login instead.");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoKey]);

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {error ? (
          <>
            <h1 className="text-lg font-extrabold text-slate-900">Demo login failed</h1>
            <p className="mt-2 text-sm text-slate-500">{error}</p>
            <button onClick={() => go("auth")}
              className="mt-5 w-full rounded-xl bg-[#004fc5] py-3 text-sm font-bold text-white hover:bg-[#003a94]">
              Go to sign-in
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto w-10 h-10 border-[3px] border-slate-200 border-t-[#004fc5] rounded-full animate-spin" />
            <h1 className="mt-5 text-lg font-extrabold text-slate-900">Opening demo profile…</h1>
            <p className="mt-1 text-sm text-slate-500">
              {entry ? `Signing in as ${entry.label}.` : "Checking QR code…"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
