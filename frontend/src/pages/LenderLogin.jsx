import { useState } from "react";
import logo from "../assets/Settl Logo.png";
import { verifyLender } from "../data/lenderDemo.js";

export default function LenderLogin({ go }) {
  const [email, setEmail] = useState("credit@ruhunafinance.demo");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Demo auth against hardcoded lender directory (see src/data/lenderDemo.js).
    // Production swaps this for POST /api/auth/lender/login.
    window.setTimeout(() => {
      const lender = verifyLender(email, password);
      setLoading(false);
      if (!lender) {
        setError("Invalid lender credentials. Try a demo account below.");
        return;
      }
      localStorage.setItem("lender_session", JSON.stringify({
        institution: lender.institution,
        email: lender.email,
        officer: lender.officer,
        min_score: lender.min_score,
        min_confidence: lender.min_confidence,
        logged_in_at: new Date().toISOString(),
      }));
      go("lender-dashboard");
    }, 500);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#f8f9ff] px-4 py-10 text-slate-900 sm:px-6 font-sans flex items-start justify-center">
      <main className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={logo} alt="Settl" className="h-11 w-auto object-contain mx-auto" />
          <span className="mt-3 inline-block rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Lender Portal · Demo data
          </span>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
        >
          <h1 className="text-xl font-extrabold tracking-tight">Lender sign in</h1>
          <p className="mt-1 text-sm text-slate-500">
            Separate portal for bank &amp; NBFI credit teams — borrower logins don&apos;t work here.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="lender-email" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Work email
              </label>
              <input
                id="lender-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#004fc5] focus:ring-4 focus:ring-blue-100"
                placeholder="credit@yourinstitution.lk"
              />
            </div>
            <div>
              <label htmlFor="lender-password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Password
              </label>
              <input
                id="lender-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#004fc5] focus:ring-4 focus:ring-blue-100"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-[#004fc5] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#003a94] disabled:opacity-60"
          >
            {loading ? "Verifying…" : "Sign in to lender portal"}
          </button>

          <div className="mt-5 rounded-xl bg-slate-50 border border-slate-100 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Demo accounts (any password shown works)
            </p>
            <div className="space-y-1.5 text-xs text-slate-600">
              <p><span className="font-bold">credit@ruhunafinance.demo</span> · Ruhuna Finance · thresholds 620 / 50%</p>
              <p><span className="font-bold">risk@ceylonsme.demo</span> · Ceylon SME Bank · thresholds 680 / 65%</p>
              <p><span className="font-bold">underwriting@metroleasing.demo</span> · Metro Leasing · thresholds 700 / 70%</p>
              <p className="text-slate-400">Password for all: demo1234</p>
            </div>
          </div>
        </form>

        <button
          onClick={() => go("auth")}
          className="mt-4 w-full text-center text-xs font-bold text-[#004fc5] hover:underline"
        >
          ← Back to borrower sign-in
        </button>
      </main>
    </div>
  );
}
