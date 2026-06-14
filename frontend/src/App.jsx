import { useState, useEffect } from "react";
import "./App.css"; //

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      <div className="min-h-screen bg-zinc-50/80 text-zinc-950 font-sans">
        {/* Simple auth nav */}
        <div className="flex gap-4 p-4 bg-white border-b border-zinc-200 text-sm items-center shadow-sm">
          <span className="text-zinc-950 font-bold text-lg mr-4 tracking-tight">
            Settl
          </span>

          <button
            onClick={() => go("login")}
            className={
              page === "login"
                ? "text-zinc-950 font-semibold"
                : "text-zinc-400 hover:text-zinc-900 transition-colors"
            }
          >
            Login
          </button>

          <button
            onClick={() => go("register")}
            className={
              page === "register"
                ? "text-zinc-950 font-semibold"
                : "text-zinc-400 hover:text-zinc-900 transition-colors"
            }
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
    <div className="min-h-screen bg-zinc-50 text-zinc-950 font-sans">
      {/* ✅ RESPONSIVE PREMIUM FINTECH NAVBAR */}
      <div className="w-full backdrop-blur-md sticky top-0 z-50">
        <div className="px-4 sm:px-6 py-3.5 flex items-center justify-between">
          {/* Left Side: Brand Identity */}
          <div className="flex items-center gap-8">
            <span className="text-zinc-900 font-semibold text-lg md:text-4xl tracking-tight">
              Settl
            </span>

            {/* ─── DESKTOP NAVIGATION TRACK ─── */}
            <nav className="hidden ml-6 md:flex items-center gap-4 rounded-full">
              {[
                { id: "dashboard", label: "Dashboard" },
                { id: "kyc", label: "Get Verified" },
                { id: "lender", label: "Lender" },
                { id: "paypal-connect", label: "Connect PayPal" },
                { id: "paypal-dashboard", label: "PayPal Dashboard" },
              ].map((tab) => {
                const isActive = page === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => go(tab.id)}
                    className={`px-4 py-2 text-xs font-semibold rounded-full transition-all duration-200 ${
                      isActive
                        ? "bg-zinc-950 text-white shadow-[0_2px_8px_rgba(0,0,0,0.1)] scale-[1.02]"
                        : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/70"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Side: Action Triggers & Menu Controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Profile Avatar Node */}
            <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 shadow-sm flex items-center justify-center text-xs overflow-hidden font-bold text-zinc-700">
              <span className="tracking-tighter">U</span>
            </div>

            {/* Desktop Logout Button */}
            <button
              onClick={logout}
              className="hidden md:block text-xs font-bold text-zinc-400 hover:text-red-600 px-2 py-2 transition-colors"
            >
              Logout
            </button>

            {/* ─── MOBILE MENU HAMBURGER TRIGGER ─── */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-9 h-9 rounded-xl bg-zinc-50 border border-zinc-200/80 flex flex-col items-center justify-center gap-1.5 hover:bg-zinc-100 transition"
            >
              <span
                className={`w-4 h-0.5 bg-zinc-800 transition-transform duration-200 ${mobileMenuOpen ? "rotate-45 translate-y-1" : ""}`}
              />
              <span
                className={`w-4 h-0.5 bg-zinc-800 transition-opacity duration-200 ${mobileMenuOpen ? "opacity-0" : ""}`}
              />
              <span
                className={`w-4 h-0.5 bg-zinc-800 transition-transform duration-200 ${mobileMenuOpen ? "-rotate-45 -translate-y-1" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* ─── MOBILE EXPANDED DROPDOWN PANEL (Smooth Slide Configuration) ─── */}
        <div
          className={`md:hidden border-t border-zinc-100 bg-white/95 backdrop-blur-lg overflow-hidden transition-all duration-300 ease-in-out origin-top ${
            mobileMenuOpen
              ? "max-h-100 opacity-100 shadow-lg pointer-events-auto"
              : "max-h-0 opacity-0 pointer-events-none"
          }`}
        >
          <div className="px-4 py-3 space-y-1">
            {[
              { id: "dashboard", label: "Dashboard" },
              { id: "kyc", label: "Get Verified" },
              { id: "lender", label: "Lender" },
              { id: "paypal-connect", label: "Connect PayPal" },
              { id: "paypal-dashboard", label: "PayPal Dashboard" },
            ].map((tab) => {
              const isActive = page === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    go(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-150 ${
                    isActive
                      ? "bg-zinc-950 text-white translate-x-1"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 active:scale-[0.98]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}

            <div className="pt-2 border-t border-zinc-100 mt-2">
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT ROUTER WITH PREMIUM TRANSITION ─── */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div
          key={page} // ✨ This key tells React to re-trigger the smooth fade animation every time the page swaps
          className="animate-pageIn"
        >
          {page === "dashboard" && (
            <Dashboard token={token} userId={userId} go={go} />
          )}

          {page === "kyc" && <KYC token={token} go={go} />}

          {page === "lender" && <Lender />}

          {page === "paypal-connect" && <PayPalConnect go={go} />}

          {page === "paypal-callback" && (
            <PayPalCallback go={go} setUserId={setUserId} />
          )}

          {page === "paypal-success" && <PayPalSuccess go={go} />}

          {page === "paypal-dashboard" && <PayPalDashboard />}
        </div>
      </main>
    </div>
  );
}
