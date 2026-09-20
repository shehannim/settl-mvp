import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

export default function LinkedInConnect({ go }) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const handleConnect = async () => {
    try {
      setLoading(true);
      setNotice("");
      setError("");

      const token = localStorage.getItem("token");

      if (!token) {
        setError("Please log in first.");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API}/api/connect/linkedin`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        setError("Session expired. Please log in again.");
        setLoading(false);
        return;
      }

      if (res.status === 503) {
        setNotice(
          "LinkedIn linking isn't enabled on this deployment yet — the app needs LinkedIn developer credentials. Education stays self-declared for now."
        );
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to initiate LinkedIn connection");
      }

      const data = await res.json();

      // Only leave the site for a real provider URL.
      if (!data.auth_url || !/^https?:\/\//i.test(data.auth_url)) {
        throw new Error("No auth URL received from backend");
      }

      window.location.href = data.auth_url;
    } catch (err) {
      setError("Failed to connect LinkedIn. Please try again.");
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
          <span className="bg-[#0A66C2] text-white text-sm font-medium px-3 py-1 rounded-lg">LinkedIn</span>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">Verify with LinkedIn</h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Link your LinkedIn profile to strengthen identity verification. Education history
          (where your plan allows) boosts confidence — it never affects income scoring.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Settl reads only</p>
          {["Name and profile URL", "Most recent education (if permitted)", "Current headline"].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-gray-700 mb-2">
              <span className="text-teal-600">✓</span> {item}
            </div>
          ))}
          <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
            <span>✕</span> No posting, no messaging, no contact access
          </div>
        </div>

        {notice && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs leading-relaxed">
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={loading}
          className="w-full bg-[#0A66C2] hover:bg-[#084e96] disabled:bg-gray-400 text-white rounded-xl py-3.5 text-sm font-medium transition-colors"
        >
          {loading ? "Connecting..." : "Continue with LinkedIn"}
        </button>

        <button
          onClick={() => go && go("income-streams")}
          className="mt-3 w-full text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-colors py-2"
        >
          ← Back to Income Streams
        </button>

        <p className="text-xs text-gray-400 text-center mt-3 leading-relaxed">
          You&apos;ll be redirected to LinkedIn securely.<br />Settl never sees your LinkedIn password.
        </p>
      </div>
    </div>
  );
}
