import { useState, useEffect } from "react";

// ✅ Pages (FIXED: added .jsx ONLY)
import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import KYC from "./pages/KYC.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Lender from "./pages/Lender.jsx";

import PayPalConnect from "./pages/PayPalConnect.jsx";
import PayPalCallback from "./pages/PayPalCallback.jsx";
import PayPalDashboard from "./pages/PayPalDashboard.jsx";
import PayPalSuccess from "./pages/PayPalSuccess.jsx";

export default function App() {
  // ✅ Read token from localStorage when app starts
  const savedToken = localStorage.getItem("token");

  // ✅ If token exists, start on dashboard. Otherwise start on login.
  const [page, setPage] = useState(savedToken ? "dashboard" : "login");
  const [token, setToken] = useState(savedToken || "");
  const [userId, setUserId] = useState("");

  const go = (p) => setPage(p);

  // ✅ Logout function
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("paypal_user_id");
    setToken("");
    setUserId("");
    setPage("login");
  };

  // ✅ Detect PayPal OAuth callback/success automatically
  useEffect(() => {
    const search = window.location.search;
    const path = window.location.pathname;

    if (search.includes("code=")) {
      setPage("paypal-callback");
      return;
    }

    if (path.includes("/connect/paypal/success")) {
      setPage("paypal-success");
      return;
    }
  }, []);

  // ✅ AUTH SCREEN
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">

        <div className="flex gap-4 p-4 bg-gray-900 border-b border-gray-800 text-sm">
          <span className="text-emerald-400 font-bold text-lg mr-4">
            Settl
          </span>

          <button
            onClick={() => go("login")}
            className={page === "login" ? "text-emerald-400" : "text-gray-400 hover:text-white"}
          >
            Login
          </button>

          <button
            onClick={() => go("register")}
            className={page === "register" ? "text-emerald-400" : "text-gray-400 hover:text-white"}
          >
            Register
          </button>
        </div>

        {page === "login" && (
          <Login setToken={setToken} setUserId={setUserId} go={go} />
        )}

        {page === "register" && (
          <Register setToken={setToken} setUserId={setUserId} go={go} />
        )}
      </div>
    );
  }

  // ✅ LOGGED-IN APP
  return (
    <div className="min-h-screen bg-gray-950 text-white">

      <div className="flex gap-4 p-4 bg-gray-900 border-b border-gray-800 text-sm flex-wrap items-center">
        <span className="text-emerald-400 font-bold text-lg mr-4">
          Settl
        </span>

        <button onClick={() => go("dashboard")}
          className={page === "dashboard" ? "text-emerald-400" : "text-gray-400 hover:text-white"}>
          Dashboard
        </button>

        <button onClick={() => go("kyc")}
          className={page === "kyc" ? "text-emerald-400" : "text-gray-400 hover:text-white"}>
          KYC
        </button>

        <button onClick={() => go("lender")}
          className={page === "lender" ? "text-emerald-400" : "text-gray-400 hover:text-white"}>
          Lender
        </button>

        <button onClick={() => go("paypal-connect")}
          className={page === "paypal-connect" ? "text-emerald-400" : "text-gray-400 hover:text-white"}>
          Connect PayPal
        </button>

        <button onClick={() => go("paypal-dashboard")}
          className={page === "paypal-dashboard" ? "text-emerald-400" : "text-gray-400 hover:text-white"}>
          PayPal Dashboard
        </button>

        <button onClick={logout}
          className="ml-auto text-red-400 hover:text-red-300">
          Logout
        </button>
      </div>

      {/* ✅ PAGE RENDERING */}

      {page === "dashboard" && (
        <Dashboard token={token} userId={userId} go={go} />
      )}

      {page === "kyc" && (
        <KYC token={token} go={go} />
      )}

      {page === "lender" && (
        <Lender />
      )}

      {page === "paypal-connect" && (
        <PayPalConnect go={go} />
      )}

      {page === "paypal-callback" && (
        <PayPalCallback go={go} setUserId={setUserId} />
      )}

      {page === "paypal-success" && (
        <PayPalSuccess go={go} />
      )}

      {page === "paypal-dashboard" && (
        <PayPalDashboard />
      )}

    </div>
  );
}
