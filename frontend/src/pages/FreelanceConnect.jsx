import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

const CONFIG = {
  upwork: {
    name: "Upwork",
    short: "Up",
    accent: "bg-[#14a800]",
    accentHover: "hover:bg-[#108600]",
    hint: "Find it at upwork.com → Settings → Get verified / profile URL.",
    placeholderUrl: "https://www.upwork.com/freelancers/~...",
    placeholderName: "e.g. A. Perera — Webflow Developer",
    demo: { accountName: "A. Perera — Webflow Developer", profileUrl: "https://www.upwork.com/freelancers/~demo01", monthlyAvg: "195000", months: 12 },
  },
  fiverr: {
    name: "Fiverr",
    short: "Fi",
    accent: "bg-[#00b22d]",
    accentHover: "hover:bg-[#009325]",
    hint: "Find it at fiverr.com → Profile → share link.",
    placeholderUrl: "https://www.fiverr.com/username",
    placeholderName: "e.g. designwithdamidu",
    demo: { accountName: "designwithdamidu — Level 2 Seller", profileUrl: "https://www.fiverr.com/designwithdamidu", monthlyAvg: "185000", months: 12 },
  },
};

export default function FreelanceConnect({ go, source = "upwork" }) {
  const cfg = CONFIG[source] || CONFIG.upwork;
  const [accountName, setAccountName] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [monthlyAvg, setMonthlyAvg] = useState("");
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in first.");
        return;
      }
      const avg = Number(monthlyAvg);
      if (!avg || avg <= 0) {
        setError("Enter your average monthly earnings in LKR.");
        return;
      }

      const res = await fetch(`${API}/api/connect/manual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source,
          account_name: accountName || profileUrl || `${cfg.name} profile`,
          profile_url: profileUrl,
          monthly_avg_lkr: avg,
          months: Number(months) || 6,
        }),
      });

      if (res.status === 401) {
        setError("Session expired. Please log in again.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to connect");
      }
      setSuccess(
        `${cfg.name} verified. It now counts toward your income diversity and confidence.`
      );
    } catch {
      setError(`Failed to connect ${cfg.name}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-md shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <span className="bg-teal-800 text-teal-200 text-sm font-medium px-3 py-1 rounded-lg">Settl</span>
          <span className="text-gray-400 text-lg">⇄</span>
          <span className={`${cfg.accent} text-white text-sm font-medium px-3 py-1 rounded-lg`}>
            {cfg.name}
          </span>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">Connect your {cfg.name} profile</h1>
        <p className="text-sm text-gray-500 mb-4 leading-relaxed">
          {cfg.name} has no public freelancer OAuth, so Settl verifies via your public
          profile + declared earnings. This feeds the same income engine as PayPal/Payoneer.
        </p>
        <button
          onClick={() => {
            setAccountName(cfg.demo.accountName);
            setProfileUrl(cfg.demo.profileUrl);
            setMonthlyAvg(cfg.demo.monthlyAvg);
            setMonths(cfg.demo.months);
            setError("");
          }}
          className="mb-6 w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 py-2.5 text-xs font-bold text-slate-600 hover:border-[#004fc5] hover:text-[#004fc5]"
        >
          ⚡ Fill with demo data (for demo walkthroughs)
        </button>

        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Settl stores only</p>
          {["Public profile URL", "Declared monthly average (LKR)", "History length in months"].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-gray-700 mb-2">
              <span className="text-teal-600">✓</span> {item}
            </div>
          ))}
          <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
            <span>✕</span> No password, no private messages, no withdrawals
          </div>
        </div>

        <label className="block text-xs font-bold text-slate-600 mb-1.5">Display name / title</label>
        <input
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder={cfg.placeholderName}
          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm mb-3 focus:outline-none focus:border-[#004fc5] focus:ring-2 focus:ring-[#004fc5]/15"
        />

        <label className="block text-xs font-bold text-slate-600 mb-1.5">{cfg.name} profile URL</label>
        <input
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
          placeholder={cfg.placeholderUrl}
          inputMode="url"
          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm mb-1 focus:outline-none focus:border-[#004fc5] focus:ring-2 focus:ring-[#004fc5]/15"
        />
        <p className="text-[11px] text-slate-400 mb-3">{cfg.hint}</p>

        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Avg / month (LKR)</label>
            <input
              value={monthlyAvg}
              onChange={(e) => setMonthlyAvg(e.target.value)}
              placeholder="e.g. 180000"
              inputMode="numeric"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#004fc5] focus:ring-2 focus:ring-[#004fc5]/15"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">History (months)</label>
            <select
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:border-[#004fc5]"
            >
              {[3, 6, 12, 18, 24].map((m) => (
                <option key={m} value={m}>{m} months</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs leading-relaxed">
            {success}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => go && go("income-streams")}
                className="flex-1 rounded-full bg-slate-900 text-white py-2 text-xs font-bold hover:bg-slate-700"
              >
                ← Back to Income Streams
              </button>
              <button
                onClick={() => go && go("paypal-dashboard")}
                className="flex-1 rounded-full border border-slate-200 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                View Income →
              </button>
            </div>
          </div>
        )}

        {!success && (
          <button
            onClick={handleConnect}
            disabled={loading}
            className={`mt-4 w-full ${cfg.accent} ${cfg.accentHover} disabled:bg-gray-400 text-white rounded-xl py-3.5 text-sm font-medium transition-colors`}
          >
            {loading ? "Verifying..." : `Connect ${cfg.name}`}
          </button>
        )}

        <button
          onClick={() => go && go("income-streams")}
          className="mt-3 w-full text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-colors py-2"
        >
          ← Back to Income Streams
        </button>
      </div>
    </div>
  );
}
