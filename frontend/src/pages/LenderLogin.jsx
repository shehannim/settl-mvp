import { useState } from "react";
import axios from "axios";
import logo from "../assets/Settl Logo.png";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

export default function LenderLogin({ go }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Live lender accounts only (lenders table). Accounts are provisioned
    // by an admin — see backend/scripts/create_lender.py.
    try {
      const res = await axios.post(`${API}/api/auth/lender/login`, {
        email: email.trim(),
        password,
      });
      localStorage.setItem("lender_session", JSON.stringify({
        lender_id: res.data.user_id,
        email: email.trim(),
        lender_token: res.data.access_token,
        logged_in_at: new Date().toISOString(),
      }));
      setLoading(false);
      go("lender-dashboard");
    } catch (liveErr) {
      setLoading(false);
      setError(
        liveErr.response?.data?.detail ||
          "Invalid lender credentials. Contact your administrator for access."
      );
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#f8f9ff] px-4 py-10 text-slate-900 sm:px-6 font-sans flex items-start justify-center">
      <main className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={logo} alt="Settl" className="h-11 w-auto object-contain mx-auto" />
          <span className="mt-3 inline-block rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Lender Portal
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
