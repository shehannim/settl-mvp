import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

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

    // ✅ Call YOUR backend callback (NOT /exchange-token)
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
        setTimeout(() => go("paypal-success"), 800);
      })
      .catch((err) => {
        console.error(err);
        setStatus("error");
        setError("Failed to connect PayPal.");
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">

      {/* ✅ PROCESSING */}
      {status === "processing" && (
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-400 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-400 text-sm">
            Connecting your PayPal account…
          </p>
        </div>
      )}

      {/* ✅ SUCCESS (very quick) */}
      {status === "success" && (
        <div className="text-center">
          <div className="text-4xl text-emerald-400 mb-3">✓</div>
          <p className="font-medium">PayPal connected!</p>
        </div>
      )}

      {/* ✅ ERROR */}
      {status === "error" && (
        <div className="text-center max-w-sm">
          <p className="text-red-500 font-medium mb-2">
            Connection failed
          </p>

          <p className="text-gray-400 text-sm mb-4">
            {error}
          </p>

          <button
            onClick={() => go("paypal-connect")}
            className="text-sm text-emerald-400 underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
``