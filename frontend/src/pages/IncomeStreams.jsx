import { useState } from "react";
import logoBlack from "../assets/Settl Logo Black.png";
import paypalLogo from "../assets/paypal.png";

const steps = [
  { num: "01", name: "Personal Details", detail: "Completed", status: "completed" },
  { num: "02", name: "Income Streams", detail: "Connect gig accounts", status: "active" },
  { num: "03", name: "Score Calibration", detail: "Alternative credit baseline", status: "pending" },
];

const platforms = [
  {
    id: "paypal",
    short: "PP",
    name: "PayPal",
    detail: "Global USD/EUR Payouts",
    tone: "text-[#004fc5]",
    icon: paypalLogo,
    badge: "Recommended",
  },
  {
    id: "payoneer",
    short: "Py",
    name: "Payoneer",
    detail: "Cross-Border Freelance Funds",
    tone: "text-amber-500",
    badge: "Popular",
  },
  {
    id: "upwork",
    short: "Up",
    name: "Upwork",
    detail: "Direct Contract Earnings",
    tone: "text-emerald-600",
  },
  {
    id: "fiverr",
    short: "Fi",
    name: "Fiverr",
    detail: "Global Freelance Revenue",
    tone: "text-emerald-500",
  },
];

export default function IncomeStreams({ go }) {
  const [notice, setNotice] = useState("");

  const handleConnect = (platform) => {
    if (platform.id === "paypal") {
      go("paypal-dashboard");
      return;
    }
    setNotice(`${platform.name} connection integration is coming soon. PayPal is active now.`);
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="flex min-h-screen w-full flex-col overflow-hidden bg-white lg:h-screen lg:min-h-0 lg:flex-row">
        {/* Left Hero Column with Rich Blue Gradient & Polished Progress Tracker */}
        <section className="relative flex min-h-[46vh] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#004fc5] via-[#0d62e0] to-[#043b9c] p-8 text-white lg:min-h-0 lg:w-1/2 lg:p-10 xl:p-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-indigo-500/25 blur-3xl" />

          {/* Heading */}
          <div className="relative z-10 max-w-lg">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight lg:text-4xl xl:text-5xl text-white">
              Income Streams
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-blue-100 lg:text-base">
              Connect your freelance earnings to calculate and calibrate your verified credit profile.
            </p>
          </div>

          {/* Elevated Progress Tracker */}
          <div className="relative z-10 my-6 space-y-3 lg:my-0">
            {steps.map((step) => {
              const isActive = step.status === "active";
              const isCompleted = step.status === "completed";
              return (
                <div
                  key={step.num}
                  className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${
                    isActive
                      ? "border-white/40 bg-white/20 shadow-lg shadow-blue-900/20 backdrop-blur-md ring-1 ring-white/30"
                      : isCompleted
                      ? "border-emerald-400/30 bg-emerald-500/15 backdrop-blur-sm"
                      : "border-white/10 bg-white/5 opacity-70 backdrop-blur-xs"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm transition-all ${
                      isActive
                        ? "bg-white text-[#004fc5] shadow-md shadow-black/10"
                        : isCompleted
                        ? "bg-emerald-400 text-slate-900 font-extrabold"
                        : "border border-white/20 bg-white/10 text-blue-200"
                    }`}
                  >
                    {isCompleted ? "✓" : step.num}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-white tracking-tight">{step.name}</p>
                      {isActive && (
                        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-100">
                          In Progress
                        </span>
                      )}
                      {isCompleted && (
                        <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-blue-200/90 mt-0.5 truncate">{step.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative z-10">
            <span className="text-xs font-medium text-blue-200/80">Step 2 of 3 · Gig Accounts Link</span>
          </div>
        </section>

        {/* Right Content Section */}
        <section className="flex min-h-[54vh] flex-1 flex-col justify-between overflow-y-auto p-6 sm:p-8 lg:min-h-0 lg:px-10 lg:py-12 xl:px-14">
          <div className="mx-auto w-full max-w-xl">
            <div className="border-b border-slate-100 pb-5">
              <img
                src={logoBlack}
                alt="Settl"
                className="mb-5 h-10 sm:h-12 w-auto object-contain lg:hidden"
              />
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Connect Income Streams
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Link your gig accounts in under 60 seconds with read-only access.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {platforms.map((platform) => (
                <div
                  key={platform.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-[#004fc5]/50 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 p-2 font-bold shadow-xs">
                        {platform.icon ? (
                          <img
                            src={platform.icon}
                            alt={platform.name}
                            className="h-6 w-auto object-contain"
                          />
                        ) : (
                          <span className={`text-base font-extrabold ${platform.tone}`}>
                            {platform.short}
                          </span>
                        )}
                      </div>
                      {platform.badge && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-[#004fc5]">
                          {platform.badge}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 text-base font-bold text-slate-900">{platform.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">{platform.detail}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleConnect(platform)}
                    className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2 text-xs font-bold text-[#004fc5] transition group-hover:border-[#004fc5] group-hover:bg-[#004fc5] group-hover:text-white cursor-pointer"
                  >
                    + Connect
                  </button>
                </div>
              ))}
            </div>

            {notice && (
              <p
                role="status"
                className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-sm font-medium text-[#004fc5]"
              >
                {notice}
              </p>
            )}
          </div>

          <div className="mt-10 flex flex-col-reverse items-center justify-between gap-4 border-t border-slate-100 pt-6 sm:flex-row">
            <button
              type="button"
              onClick={() => go("dashboard")}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 transition cursor-pointer"
            >
              Skip for now / View Dashboard
            </button>
            <button
              type="button"
              onClick={() => go("score-calibration")}
              className="w-full rounded-full bg-[#004fc5] px-8 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg shadow-blue-500/25 transition hover:bg-[#00388c] sm:w-auto cursor-pointer"
            >
              Finish Setup &amp; View Score →
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
