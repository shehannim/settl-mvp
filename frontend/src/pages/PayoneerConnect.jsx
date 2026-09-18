import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

export default function PayoneerConnect({ go }) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const handleConnect = async () => {
    try {
      setLoading(true);
      setNotice("");

      const token = localStorage.getItem("token");

      if (!token) {
        alert("⚠️ Please log in first");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API}/api/connect/payoneer`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        alert("❌ Unauthorized. Please login again.");
        setLoading(false);
        return;
      }

      // Partner credentials not issued yet → statement upload fallback.
      if (res.status === 503) {
        setNotice(
          "Direct Payoneer linking isn't enabled on this deployment yet. Upload a Payoneer monthly statement PDF instead — it feeds the same income engine."
        );
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        console.error("Backend error:", text);
        throw new Error("Failed to initiate Payoneer connection");
      }

      const data = await res.json();

      if (!data.auth_url) {
        throw new Error("No auth URL received from backend");
      }

      window.location.href = data.auth_url;
    } catch (error) {
      console.error("Payoneer connect error:", error);
      alert("❌ Failed to connect Payoneer. Check console.");
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
          <span className="bg-orange-600 text-orange-100 text-sm font-medium px-3 py-1 rounded-lg">Payoneer</span>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">Connect your Payoneer account</h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Settl uses your Payoneer payout history to build an alternative credit score — no formal bank history needed.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Settl will have read-only access to</p>
          {["Payout history (last 24 months)", "Payment frequency & consistency", "Account verification status"].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-gray-700 mb-2">
              <span className="text-teal-600">✓</span> {item}
            </div>
          ))}
          <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
            <span>✕</span> No ability to move funds or initiate payouts
          </div>
        </div>

        {notice && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs leading-relaxed">
            {notice}
            <button
              onClick={() => go && go("bill-upload")}
              className="block mt-2 font-bold underline underline-offset-2"
            >
              Go to statement upload →
            </button>
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={loading}
          className="w-full bg-[#ff4800] hover:bg-[#d63d00] disabled:bg-gray-400 text-white rounded-xl py-3.5 text-sm font-medium transition-colors"
        >
          {loading ? "Connecting..." : "Continue with Payoneer"}
        </button>

        <p className="text-xs text-gray-400 text-center mt-3 leading-relaxed">
          You&apos;ll be redirected to Payoneer securely.<br />Settl never sees your Payoneer password.
        </p>
      </div>
    </div>
  );
}
