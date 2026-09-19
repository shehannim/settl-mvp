import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

export default function PayPalConnect() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

      if (!token) {
        setError("Please log in first.");
        setLoading(false);
        return;
      }

      const res = await fetch(
        `${API}/api/connect/paypal`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.status === 401) {
        setError("Session expired. Please log in again.");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to initiate PayPal connection");
      }

      const data = await res.json();

      if (!data.auth_url) {
        throw new Error("No auth URL received from backend");
      }

      window.location.href = data.auth_url;

    } catch (err) {
      setError("Failed to connect PayPal. Please try again.");
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
          <span className="bg-blue-900 text-blue-200 text-sm font-medium px-3 py-1 rounded-lg">PayPal</span>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">Connect your PayPal account</h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Settl uses your PayPal transaction history to build an alternative credit score — no formal bank history needed.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Settl will have read-only access to</p>
          {["Transaction history (last 24 months)", "Payment frequency & consistency", "Account verification status"].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-gray-700 mb-2">
              <span className="text-teal-600">✓</span> {item}
            </div>
          ))}
          <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
            <span>✕</span> No ability to make payments or transfers
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={loading}
          className="w-full bg-[#003087] hover:bg-[#002060] disabled:bg-gray-400 text-white rounded-xl py-3.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {loading ? "Connecting..." : "Continue with PayPal"}
          {!loading && <PayPalIcon />}
        </button>

        <p className="text-xs text-gray-400 text-center mt-3 leading-relaxed">
          You'll be redirected to PayPal securely.<br />Settl never sees your PayPal password.
        </p>
      </div>
    </div>
  );
}

function PayPalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M7.5 21H3L6 3h7c2.5 0 5 1.5 4.5 5C17 10.5 14 12 11.5 12H9L7.5 21Z" fill="#009cde"/>
      <path d="M10.5 21H6L9 3h7c2.5 0 5 1.5 4.5 5C20 10.5 17 12 14.5 12H12L10.5 21Z" fill="#012169" opacity="0.8"/>
    </svg>
  );
}