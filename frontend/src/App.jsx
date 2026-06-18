import { useState, useEffect, useRef } from "react";
import "./App.css";

// Pages
import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import KYC from "./pages/KYC.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import BillUpload from "./pages/BillUpload.jsx";
import PayPalConnect from "./pages/PayPalConnect.jsx";
import PayPalCallback from "./pages/PayPalCallback.jsx";
import PayPalDashboard from "./pages/PayPalDashboard.jsx";
import PayPalSuccess from "./pages/PayPalSuccess.jsx";

/* =========================
   Icons
========================= */

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function ChevronDownIcon({ open = false }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m21 7-9 6-9-6" />
    </svg>
  );
}

function IdIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <line x1="8" y1="10" x2="8" y2="10" />
      <line x1="12" y1="10" x2="16" y2="10" />
      <line x1="12" y1="14" x2="16" y2="14" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

/* =========================
   Fingerprint Logo
========================= */

function FingerprintMark({ className = "w-6 h-6", stroke = "white" }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Settl fingerprint mark"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M34 7c-7 0-12 2-16 7" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
      <path d="M43 10c-3-3-7-5-12-6" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
      <path d="M50 18c-1-3-3-6-5-8" stroke={stroke} strokeWidth="4" strokeLinecap="round" />

      <path d="M18 34c0-14 9-24 20-24 9 0 17 6 20 15" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
      <path d="M14 46c0-19 11-31 24-31 11 0 20 8 22 20" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
      <path d="M14 56c0-4 0-8 0-11 0-19 11-34 26-34 12 0 22 8 25 22" stroke={stroke} strokeWidth="4" strokeLinecap="round" />

      <path d="M24 58c-5-5-8-12-8-20 0-13 8-22 18-22 8 0 15 6 17 14" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
      <path d="M32 59c-6-4-10-11-10-19 0-10 6-17 14-17 7 0 12 5 13 12" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
      <path d="M40 56c-2 0-5-1-7-3-4-3-6-8-6-13 0-7 4-12 10-12 5 0 9 4 9 10" stroke={stroke} strokeWidth="4" strokeLinecap="round" />

      <path d="M39 48c0 3-1 6-3 8" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
      <path d="M35 50c-4-2-6-6-6-11 0-5 3-8 7-8 4 0 7 3 7 7 0 2-1 5-2 6" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
      <path d="M34 57c-2-1-4-2-6-4-3-3-5-8-5-13" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/* =========================
   App
========================= */

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const profileMenuRef = useRef(null);
  const profileButtonRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const mobileButtonRef = useRef(null);

  const savedToken = localStorage.getItem("token");
  const [page, setPage] = useState(savedToken ? "dashboard" : "login");
  const [token, setToken] = useState(savedToken || "");
  const [userId, setUserId] = useState(localStorage.getItem("userId") || "");

  const go = (p) => {
    setPage(p);
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("paypal_user_id");
    localStorage.removeItem("userId");
    setToken("");
    setUserId("");
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
    setPage("login");
  };

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

  /* outside click handling */
  useEffect(() => {
    function handleClickOutside(event) {
      // profile dropdown
      if (
        profileMenuOpen &&
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target) &&
        profileButtonRef.current &&
        !profileButtonRef.current.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }

      // mobile menu
      if (
        mobileMenuOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target) &&
        mobileButtonRef.current &&
        !mobileButtonRef.current.contains(event.target)
      ) {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileMenuOpen, mobileMenuOpen]);

  const userEmail = localStorage.getItem("email") || "user@settl.io";
  const storedName = localStorage.getItem("name");
  const userName =
    storedName ||
    userEmail
      .split("@")[0]
      .replace(/\./g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) ||
    "User Name";

  const profileType = "Personal";
  const accountStatus = "Verified";
  const firstLetter = userName?.[0]?.toUpperCase() || "U";
  const displayUserId = userId || localStorage.getItem("userId") || "USR-29184";

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "paypal-dashboard", label: "Income" },
    { id: "bill-upload", label: "Bills" },
    
  ];

  /* ================= AUTH VIEW ================= */
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-xl border-b border-black/5">
          <div className="max-w-[1500px] mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
            <button
              onClick={() => go("login")}
              className="flex items-center gap-3 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shadow-sm">
                <FingerprintMark className="w-6 h-6" stroke="white" />
              </div>
              <span className="font-semibold text-lg tracking-tight text-slate-900">
                Settl
              </span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => go("login")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  page === "login"
                    ? "bg-black text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => go("register")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  page === "register"
                    ? "bg-black text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Register
              </button>
            </div>
          </div>
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <style>{`
        @keyframes dropdownIn {
          0% {
            opacity: 0;
            transform: translateY(-8px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes mobileMenuIn {
          0% {
            opacity: 0;
            transform: translateY(-10px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .dropdown-animate {
          animation: dropdownIn 160ms ease-out;
          transform-origin: top right;
        }

        .mobilemenu-animate {
          animation: mobileMenuIn 170ms ease-out;
          transform-origin: top center;
        }

        .glass-dropdown {
          background: rgba(255,255,255,0.62);
          backdrop-filter: blur(22px) saturate(160%);
          -webkit-backdrop-filter: blur(22px) saturate(160%);
          border: 1px solid rgba(255,255,255,0.45);
          box-shadow: 0 12px 30px rgba(15,23,42,0.08);
        }
      `}</style>

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 w-full bg-white/70 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-[1500px] mx-auto h-[76px] px-4 sm:px-6 md:px-10 flex items-center justify-between">

          {/* LEFT */}
          <div className="flex items-center gap-6 lg:gap-8">
            <button
              onClick={() => go("dashboard")}
              className="flex items-center gap-3 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shadow-sm">
                <FingerprintMark className="w-6 h-6" stroke="white" />
              </div>

              <span className="font-semibold text-[18px] tracking-tight text-slate-900">
                Settl
              </span>
            </button>

            {/* DESKTOP TABS */}
            <div className="hidden md:flex items-center gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => go(tab.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    page === tab.id
                      ? "bg-black text-white shadow-sm"
                      : "text-slate-600 hover:text-black hover:bg-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-3">
            {/* HAMBURGER BUTTON */}
            <button
              ref={mobileButtonRef}
              className="md:hidden w-10 h-10 rounded-full bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 transition"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Open menu"
            >
              <MenuIcon />
            </button>

            {/* PROFILE BUTTON */}
            <div className="relative">
              <button
                ref={profileButtonRef}
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="
                  h-11 pl-2.5 pr-3.5 rounded-full
                  bg-white border border-slate-200
                  shadow-[0_6px_18px_rgba(15,23,42,0.05)]
                  flex items-center gap-2.5
                  hover:bg-slate-50 transition-all duration-200
                "
              >
                <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-sm font-semibold">
                  {firstLetter}
                </div>

                <div className="hidden sm:flex flex-col items-start leading-none">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-slate-400 font-semibold">
                    My Account
                  </span>
                  <span className="text-sm font-medium text-slate-800 flex items-center gap-1">
                    Profile
                    <ChevronDownIcon open={profileMenuOpen} />
                  </span>
                </div>
              </button>

              {/* PROFILE DROPDOWN — blur only here */}
              {profileMenuOpen && (
                <div
                  ref={profileMenuRef}
                  className="
                    dropdown-animate
                    absolute right-0 top-[64px]
                    w-[340px] sm:w-[360px]
                    rounded-[24px]
                    overflow-hidden
                    glass-dropdown
                    z-50
                  "
                >
                  <div className="p-5">

                    {/* HEADER */}
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center text-xl font-semibold shadow-sm">
                        {firstLetter}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-[20px] font-semibold text-slate-900 leading-tight truncate">
                          {userName}
                        </div>
                        <div className="text-sm text-slate-600 truncate mt-0.5">
                          {userEmail}
                        </div>
                        <button className="mt-2 text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900 transition">
                          Manage Account
                        </button>
                      </div>
                    </div>

                    <div className="h-px bg-slate-200 my-5" />

                    {/* DETAILS */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-slate-500">
                          <UserIcon />
                          <span>Profile</span>
                        </div>
                        <span className="font-medium text-slate-900">{profileType}</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-slate-500">
                          <MailIcon />
                          <span>Email</span>
                        </div>
                        <span className="font-medium text-slate-900 truncate max-w-[170px] text-right">
                          {userEmail}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-slate-500">
                          <IdIcon />
                          <span>Settl ID</span>
                        </div>
                        <span className="font-medium text-slate-900">{displayUserId}</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-slate-500">
                          <ShieldIcon />
                          <span>Status</span>
                        </div>
                        <span className="font-medium text-emerald-600">{accountStatus}</span>
                      </div>
                    </div>

                    <div className="h-px bg-slate-200 my-5" />

                    {/* FEATURE CARD */}
                    <div className="rounded-2xl bg-black text-white p-4 shadow-sm">
                      <div className="text-sm font-semibold mb-1">AI Insights</div>
                      <div className="text-xs text-white/70 leading-relaxed">
                        Unlock financial intelligence and profile readiness signals.
                      </div>
                    </div>

                    <div className="h-px bg-slate-200 my-5" />

                    {/* LOGOUT */}
                    <button
                      onClick={logout}
                      className="
                        w-full flex items-center gap-3
                        px-4 py-3 rounded-2xl
                        text-red-600 hover:bg-red-50
                        transition text-sm font-medium
                      "
                    >
                      <LogoutIcon />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* MOBILE MENU — smooth dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 pt-3 relative z-30">
          <div
            ref={mobileMenuRef}
            className="mobilemenu-animate rounded-3xl bg-white border border-slate-200 shadow-sm p-3"
          >
            <div className="px-3 py-3 mb-2">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {userName}
              </div>
              <div className="text-xs text-slate-500 truncate">{userEmail}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                ID: {displayUserId}
              </div>
            </div>

            <div className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => go(tab.id)}
                  className={`
                    w-full text-left px-4 py-3 rounded-2xl text-sm font-medium transition
                    ${
                      page === tab.id
                        ? "bg-black text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="h-px bg-slate-200 my-3" />

            <button
              onClick={logout}
              className="w-full text-left px-4 py-3 rounded-2xl text-red-600 hover:bg-red-50 text-sm font-medium transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* ROUTER */}
      <main className="w-full">
        {page === "dashboard" && (
          <Dashboard token={token} userId={displayUserId} go={go} />
        )}
        {page === "kyc" && <KYC token={token} go={go} />}
        {page === "bill-upload" && (
          <BillUpload token={token} go={go} />
        )}
        {page === "paypal-connect" && <PayPalConnect go={go} />}
        {page === "paypal-callback" && (
          <PayPalCallback go={go} setUserId={setUserId} />
        )}
        {page === "paypal-success" && <PayPalSuccess go={go} />}
        {page === "paypal-dashboard" && <PayPalDashboard go={go} />}
      </main>
    </div>
  );
}