import { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

export default function PayPalSuccess({ go }) {
  const [showCheck, setShowCheck] = useState(false);
  const [calibrating, setCalibrating] = useState(true);
  const [linkMissing, setLinkMissing] = useState(false);

  useEffect(() => {
    // animate check after short delay, then auto redirect to dashboard.
    // Timers are tracked and cleared on unmount so leaving early can't
    // navigate a dead screen or leak handles.
    const checkTimer = window.setTimeout(() => setShowCheck(true), 300);
    const navTimer = window.setTimeout(() => go("paypal-dashboard"), 3500);

    // Best-effort: compute the score now so the dashboard shows it
    // immediately after connect (previously nothing triggered compute).
    // Also confirm the link is actually readable — never celebrate a
    // connection the income hub can't see.
    const authToken = localStorage.getItem("token");
    if (authToken) {
      axios
        .get(`${API}/api/connect/sources`, { headers: { Authorization: `Bearer ${authToken}` } })
        .then((res) => {
          if (!(res.data?.sources || []).some((s) => s.source === "paypal")) setLinkMissing(true);
        })
        .catch(() => {})
        .finally(() => {
          axios
            .post(`${API}/api/score/compute`, {}, { headers: { Authorization: `Bearer ${authToken}` } })
            .catch(() => {})
            .finally(() => setCalibrating(false));
        });
    } else {
      setCalibrating(false);
      setLinkMissing(true);
    }

    return () => {
      window.clearTimeout(checkTimer);
      window.clearTimeout(navTimer);
    };
  }, [go]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">

      <div className="text-center">

        {/* ✅ Animated Circle */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-full border-4 border-emerald-400 flex items-center justify-center">

          {/* ✅ Animated Check */}
          <div className={`text-4xl transition-all duration-500 ${
            showCheck ? "opacity-100 scale-100 text-emerald-400" : "opacity-0 scale-0"
          }`}>
            ✓
          </div>

        </div>

        {/* ✅ Title */}
        <h1 className="text-2xl font-bold mb-2">
          PayPal Connected!
        </h1>

        <p className="text-gray-400 mb-6">
          Your PayPal account has been successfully linked.
        </p>

        {/* ✅ Small loading animation */}
        <div className="flex justify-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-150"></div>
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-300"></div>
        </div>

        {linkMissing && !calibrating && (
          <p className="mx-auto mt-2 max-w-xs rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
            PayPal approved, but the link isn&apos;t showing on your account yet. If the income hub still says
            Connect, reconnect once from Income Streams.
          </p>
        )}
        <p className="text-sm text-gray-500 mt-4">
          {calibrating ? "Calibrating your score..." : "Redirecting to your dashboard..."}
        </p>

      </div>
    </div>
  );
}
