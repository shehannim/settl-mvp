import { useEffect, useState } from "react";

export default function PayPalSuccess({ go }) {
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    // animate check after short delay
    setTimeout(() => setShowCheck(true), 300);

    // auto redirect to dashboard
    setTimeout(() => go("paypal-dashboard"), 2500);
  }, []);

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

        <p className="text-sm text-gray-500 mt-4">
          Redirecting to your dashboard...
        </p>

      </div>
    </div>
  );
}
