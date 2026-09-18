import { useState, useEffect } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

const CAROUSEL_ITEMS = [
  {
    text: "784 avg credit baseline",
    tag: "Credit Insight",
    icon: <span className="font-mono text-lg font-bold">784</span>,
  },
  {
    text: "Unlocked LKR 450,000 credit limit",
    tag: "Financing Tier",
    icon: <span className="text-xl">💳</span>,
  },
  {
    text: "PDPA Compliant",
    tag: "Data Privacy",
    icon: <span className="text-xl">🛡️</span>,
  },
  {
    text: "Fast-track loan eligibility",
    tag: "Bank Integration",
    icon: <span className="text-xl">⚡</span>,
  },
  {
    text: "Trusted by 10,000+ freelancers",
    tag: "Community",
    icon: <span className="text-xl">⭐</span>,
  },
];

export default function MyComponent({ setToken, setUserId, go, onAuthenticated }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCarouselIndex((prev) => (prev + 1) % CAROUSEL_ITEMS.length);
        setIsVisible(true);
      }, 250);
    }, 3200);

    return () => clearInterval(timer);
  }, []);

  const submit = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await axios.post(`${API}/api/auth/login`, form);
      const token = res.data.access_token;
      const id = res.data.user_id;

      if (setToken) setToken(token);
      if (setUserId) setUserId(id);
      localStorage.setItem("token", token);
      if (id) localStorage.setItem("userId", id);

      if (onAuthenticated) {
        onAuthenticated({
          accessToken: token,
          id,
          email: form.email,
        });
      } else if (go) {
        go("dashboard");
      }
    } catch (e) {
      if (e.response) {
        setError(e.response.data.detail || "Invalid login");
      } else {
        setError("Cannot connect to server");
      }
    }

    setLoading(false);
  };

  return (
    <div className="w-full max-w-7xl mx-auto my-auto bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden flex flex-col lg:flex-row min-h-[760px] font-sans">
      {/* Left Hero Column */}
      <div className="lg:w-1/2 bg-gradient-to-br from-[#004fc5] via-[#0d62e0] to-[#043b9c] p-10 lg:p-14 flex flex-col justify-between relative overflow-hidden text-white">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-indigo-500/25 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Header in Hero */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/15">
            {/* Enlarged Settl Logo for stronger visual emphasis */}
            <svg
              viewBox="0 0 160 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 sm:h-12 w-auto"
              aria-label="Settl"
            >
              <path
                d="M6 14L16 10V38L6 34V14Z"
                fill="#FFFFFF"
                fillOpacity="0.5"
              />
              <path
                d="M19 9L29 5V43L19 39V9Z"
                fill="#FFFFFF"
                fillOpacity="0.8"
              />
              <path d="M32 4L44 0V48L32 44V4Z" fill="#FFFFFF" />
              <text
                x="56"
                y="33"
                fontFamily="'Plus Jakarta Sans', sans-serif"
                fontSize="28"
                fontWeight="800"
                fill="#FFFFFF"
                letterSpacing="-0.03em"
              >
                Settl
              </text>
              <circle cx="127" cy="30" r="3.5" fill="#FFFFFF" />
            </svg>
          </div>
        </div>

        {/* Center Hero Content */}
        <div className="relative z-10 my-10 lg:my-0 max-w-lg">
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight mb-4">
            Your work.
            <br />
            Your credit profile.
          </h1>
          <p className="text-blue-100 text-base lg:text-lg leading-relaxed mb-8">
            Underwrite your real freelance earnings across Upwork, Fiverr,
            PickMe &amp; Daraz into a verified institutional credit score.
          </p>

          {/* Animated Social Proof Carousel */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 shadow-inner min-h-[88px] flex items-center overflow-hidden">
            <div className="flex items-center gap-4 w-full">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-bold text-lg text-white shrink-0 shadow-xs transition-transform duration-300">
                {CAROUSEL_ITEMS[carouselIndex].icon}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={`transition-all duration-300 ease-out transform ${
                    isVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 -translate-y-2"
                  }`}
                >
                  <div className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">
                    {CAROUSEL_ITEMS[carouselIndex].tag}
                  </div>
                  <div className="text-sm sm:text-base font-bold text-white tracking-tight truncate mt-0.5">
                    {CAROUSEL_ITEMS[carouselIndex].text}
                  </div>
                </div>
              </div>
              {/* Cycling indicator dots */}
              <div className="flex flex-col gap-1 items-center shrink-0 pl-1">
                {CAROUSEL_ITEMS.map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === carouselIndex ? "w-3 bg-white" : "w-1.5 bg-white/30"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Status Steps indicator */}
        <div className="relative z-10 grid grid-cols-3 gap-3">
          <div className="bg-white/15 rounded-xl p-3.5 border border-white/10">
            <div className="text-[11px] font-bold text-blue-200 uppercase tracking-wide">
              01 Verify
            </div>
            <div className="text-xs font-semibold mt-1">Instant Work Auth</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3.5 border border-white/5 opacity-80">
            <div className="text-[11px] font-bold text-blue-200 uppercase tracking-wide">
              02 Consent
            </div>
            <div className="text-xs font-semibold mt-1">Read-only Stream</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3.5 border border-white/5 opacity-80">
            <div className="text-[11px] font-bold text-blue-200 uppercase tracking-wide">
              03 Score
            </div>
            <div className="text-xs font-semibold mt-1">Institutional Tier</div>
          </div>
        </div>
      </div>

      {/* Right Column: Form Panel */}
      <div className="lg:w-1/2 p-10 lg:p-16 flex flex-col justify-between bg-white">
        <div className="flex justify-between items-center pb-6 border-b border-slate-100">
          <div className="hidden sm:flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight text-slate-900">
              Settl.
            </span>
          </div>
          <div className="text-sm text-slate-500 ml-auto">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => go && go("register")}
              className="font-bold text-[#004fc5] hover:underline ml-1 cursor-pointer"
            >
              Register
            </button>
          </div>
        </div>

        {/* Center Form */}
        <div className="max-w-md w-full mx-auto py-8">
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Login to Settl
            </h2>
            <p className="text-slate-500 text-sm mt-2">
              Access your portable freelancer credit score and financing
              dashboard.
            </p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Work or Personal Email
              </label>
              <input
                type="email"
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:border-[#004fc5] focus:ring-4 focus:ring-blue-100 outline-none text-slate-900 text-sm font-medium transition-all"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:border-[#004fc5] focus:ring-4 focus:ring-blue-100 outline-none text-slate-900 text-sm font-medium transition-all"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            {error && (
              <div className="text-rose-600 text-sm font-medium tracking-wide bg-rose-50 border border-rose-200 rounded-xl p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-full bg-[#004fc5] hover:bg-[#003da1] text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Logging in..." : "Login →"}
            </button>
          </form>

          <p className="text-xs text-slate-400 text-center leading-relaxed mt-6">
            By logging in, you agree to Settl's{" "}
            <a
              href="#"
              className="text-slate-600 underline font-medium hover:text-slate-900"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="text-slate-600 underline font-medium hover:text-slate-900"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>

        {/* Trust Footer */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-emerald-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z"
                clipRule="evenodd"
              />
            </svg>
            <span>Sri Lanka PDPA No. 9 of 2022 Compliant</span>
          </div>
          <span>256-bit Bank-grade Encryption</span>
        </div>
      </div>
    </div>
  );
}
