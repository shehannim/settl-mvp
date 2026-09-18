import { useEffect, useState } from "react";
import logo from "./assets/Settl Logo Black.png";
import Auth from "./pages/Auth.jsx";
import EmailVerify from "./pages/EmailVerify.jsx";
import Consent from "./pages/Consent.jsx";
import KYC from "./pages/KYC.jsx";
import PersonalDetails from "./pages/PersonalDetails.jsx";
import IncomeStreams from "./pages/IncomeStreams.jsx";
import ScoreCalibration from "./pages/ScoreCalibration.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import BillUpload from "./pages/BillUpload.jsx";
import PayPalConnect from "./pages/PayPalConnect.jsx";
import PayPalCallback from "./pages/PayPalCallback.jsx";
import PayPalDashboard from "./pages/PayPalDashboard.jsx";
import PayPalSuccess from "./pages/PayPalSuccess.jsx";
import PayoneerConnect from "./pages/PayoneerConnect.jsx";
import PayoneerCallback from "./pages/PayoneerCallback.jsx";
import PayoneerDashboard from "./pages/PayoneerDashboard.jsx";
import PayoneerSuccess from "./pages/PayoneerSuccess.jsx";
import LenderLogin from "./pages/LenderLogin.jsx";
import LenderDashboard from "./pages/LenderDashboard.jsx";

const onboardingPages = new Set([
  "auth",
  "lender-login",
  "lender-dashboard",
  "email-verify",
  "consent",
  "kyc",
  "personal-details",
  "income-streams",
  "score-calibration",
]);

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [userId, setUserId] = useState(
    () => localStorage.getItem("userId") || "",
  );
  const [page, setPage] = useState(() => {
    if (window.location.search.includes("code=")) return "paypal-callback";
    if (window.location.pathname.includes("/connect/payoneer/success"))
      return "payoneer-success";
    if (window.location.pathname.includes("/connect/paypal/success"))
      return "paypal-success";
    const savedPage = localStorage.getItem("current_page");
    if (savedPage) return savedPage;
    return localStorage.getItem("token") ? "dashboard" : "auth";
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // OAuth landings (PayPal/Payoneer redirects) must not stay in browser
  // history: Back would otherwise walk into the provider's redirect chain,
  // which instantly bounces forward to /connect/*/success again — an
  // inescapable loop. Replace the URL with the app root on arrival.
  useEffect(() => {
    const isOAuthLanding =
      window.location.search.includes("code=") ||
      window.location.pathname.includes("/connect/paypal/success") ||
      window.location.pathname.includes("/connect/payoneer/success");
    if (isOAuthLanding) {
      window.history.replaceState({}, "", "/");
      localStorage.removeItem("current_page");
    }
  }, []);

  const go = (nextPage) => {
    localStorage.setItem("current_page", nextPage);
    setPage(nextPage);
    setMobileMenuOpen(false);
  };

  const completeAuth = ({ accessToken, id, email, name, signupMethod = "email", isRegister = false }) => {
    localStorage.setItem("token", accessToken);
    localStorage.setItem("userId", id);
    if (email) localStorage.setItem("email", email);
    if (name) localStorage.setItem("name", name);
    localStorage.setItem("auth_provider", signupMethod);
    setToken(accessToken);
    setUserId(id);

    // SSO users (Google / Apple) bypass OTP because their email is pre-verified -> go straight to PDPA Data Consent
    if (signupMethod === "google" || signupMethod === "apple") {
      go("consent");
      return;
    }

    // Email Sign-up routes directly to Email OTP verification screen
    if (isRegister) {
      go("email-verify");
      return;
    }

    // Returning user sign-in: route to dashboard or next uncompleted step
    go("dashboard");
  };

  const logout = () => {
    [
      "token",
      "userId",
      "user_id",
      "email",
      "name",
      "auth_provider",
      "email_verified",
      "pdpa_consent_granted",
      "kyc_verified",
      "kyc_status",
      "current_page",
    ].forEach((key) => localStorage.removeItem(key));
    setToken("");
    setUserId("");
    go("auth");
  };

  if (onboardingPages.has(page)) {
    if (page === "auth") return <Auth onAuthenticated={completeAuth} go={go} />;
    if (page === "lender-login") return <LenderLogin go={go} />;
    if (page === "lender-dashboard") return <LenderDashboard go={go} />;
    if (page === "email-verify") return <EmailVerify go={go} onVerified={() => go("consent")} />;
    if (page === "consent") return <Consent go={go} />;
    if (page === "kyc") return <KYC token={token} go={go} />;
    if (page === "personal-details") return <PersonalDetails go={go} />;
    if (page === "income-streams") return <IncomeStreams go={go} />;
    if (page === "score-calibration") return <ScoreCalibration go={go} token={token} />;
    return <IncomeStreams go={go} />;
  }

  const userName = localStorage.getItem("name") || "Your profile";
  const tabs = [
    ["dashboard", "Dashboard"],
    ["paypal-dashboard", "Income"],
    ["bill-upload", "Bills"],
  ];

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-slate-900 font-sans">
      <header className="sticky top-0 z-30 bg-[#f8f9ff]/80 backdrop-blur-md [-webkit-backdrop-filter:blur(12px)]">
        <div className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between px-4 sm:px-6">
          <button
            onClick={() => go("dashboard")}
            className="flex items-center"
            aria-label="Settl dashboard"
          >
            <img
              src={logo}
              alt="Settl"
              className="h-10 sm:h-9 w-auto object-contain"
            />
          </button>

          {/* Desktop Navigation */}
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Primary navigation"
          >
            {tabs.map(([id, label]) => (
              <button
                key={id}
                onClick={() => go(id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  page === id
                    ? "bg-[#004fc5] text-white shadow-xs"
                    : "text-slate-600 hover:bg-blue-50 hover:text-[#004fc5]"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Desktop Right Actions */}
          <div className="hidden md:flex items-center gap-3">
            <span className="text-sm font-medium text-slate-500">
              {userName}
            </span>
            <button
              onClick={logout}
              className="rounded-full border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              Sign out
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={
                mobileMenuOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
              }
              aria-expanded={mobileMenuOpen}
              className="flex h-10 w-10 items-center justify-center text-slate-700 hover:text-[#004fc5] active:scale-90 transition-all focus:outline-none"
            >
              <div
                className={`transition-transform duration-300 transform ${mobileMenuOpen ? "rotate-90 text-[#004fc5]" : "rotate-0"}`}
              >
                {mobileMenuOpen ? (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer with Smooth Slide & Fade Animation */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out bg-[#f8f9ff]/95 backdrop-blur-xl shadow-xl ${
            mobileMenuOpen
              ? "max-h-[380px] opacity-100 border-t border-slate-200/60"
              : "max-h-0 opacity-0 border-t-0 pointer-events-none"
          }`}
        >
          <div className="px-4 pb-5 pt-3">
            <div className="mb-3 px-3.5 py-2 rounded-xl bg-white border border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Signed in as
              </span>
              <span className="text-xs font-bold text-slate-800">
                {userName}
              </span>
            </div>

            <nav
              className="flex flex-col gap-1.5"
              aria-label="Mobile primary navigation"
            >
              {tabs.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => {
                    go(id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    page === id
                      ? "bg-[#004fc5] text-white shadow-sm"
                      : "text-slate-700 bg-white/70 hover:bg-white hover:text-[#004fc5]"
                  }`}
                >
                  <span>{label}</span>
                  {page === id && <span className="text-xs">●</span>}
                </button>
              ))}
            </nav>

            <div className="mt-4 pt-3 border-t border-slate-200/60">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/50 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 hover:text-red-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>
      <main key={page} className="animate-page-transition">
        {page === "dashboard" && (
          <Dashboard token={token} userId={userId} go={go} />
        )}
        {page === "bill-upload" && <BillUpload token={token} go={go} />}
        {page === "paypal-connect" && <PayPalConnect go={go} />}
        {page === "paypal-callback" && (
          <PayPalCallback go={go} setUserId={setUserId} />
        )}
        {page === "paypal-success" && <PayPalSuccess go={go} />}
        {page === "paypal-dashboard" && <PayPalDashboard go={go} />}
        {page === "payoneer-connect" && <PayoneerConnect go={go} />}
        {page === "payoneer-callback" && (
          <PayoneerCallback go={go} setUserId={setUserId} />
        )}
        {page === "payoneer-success" && <PayoneerSuccess go={go} />}
        {page === "payoneer-dashboard" && <PayoneerDashboard go={go} />}
      </main>
    </div>
  );
}
