import { useState } from "react";
import logo from "../assets/Settl Logo.png";

export default function Consent({ go }) {
  const [agreed, setAgreed] = useState(true);

  const handleContinue = () => {
    localStorage.setItem("pdpa_consent_granted", "true");
    go("personal-details");
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="flex min-h-screen w-full flex-col overflow-hidden bg-white lg:h-screen lg:min-h-0 lg:flex-row">
        {/* Left Hero Column */}
        <section className="relative flex min-h-[52vh] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#004fc5] via-[#0d62e0] to-[#043b9c] p-8 text-white lg:min-h-0 lg:w-1/2 lg:p-10 xl:p-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-indigo-500/25 blur-3xl" />
          <div className="relative z-10 flex items-center justify-between gap-3">
            <img
              src={logo}
              alt="Settl"
              className="h-10 sm:h-12 w-auto object-contain"
            />
          </div>
          <div className="relative z-10 my-7 max-w-lg lg:my-0">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight lg:text-5xl mb-4">
              Your work.
              <br />
              Your credit profile.
            </h1>
          </div>
          <div className="relative z-10 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              ["01 Account", "Create Profile", false, true],
              ["02 OTP", "Instant Verification", false, true],
              ["03 DPA", "Data Consent", true, false],
            ].map(([step, detail, active, completed]) => (
              <div
                key={step}
                className={`rounded-xl border p-3 transition-all ${
                  active
                    ? "border-white/40 bg-white/20 shadow-xs"
                    : completed
                    ? "border-white/20 bg-white/15"
                    : "border-white/10 bg-white/10 opacity-75"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-blue-200">
                  {completed ? "✓ " : ""}{step}
                </p>
                <p className="mt-1 text-xs font-semibold">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Right Content Column */}
        <section className="flex min-h-[48vh] flex-1 flex-col justify-between overflow-y-auto p-6 sm:p-8 lg:min-h-0 lg:px-10 lg:py-12 xl:px-14">
          <button
            onClick={() => go("auth")}
            className="self-start text-xs font-medium text-slate-400 transition hover:text-[#004fc5] cursor-pointer"
          >
            ← Back
          </button>

          <div className="mx-auto my-auto w-full max-w-md py-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Before you continue
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Settl collects and processes certain personal, identity and financial information to provide its credit-intelligence service.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Please review our{" "}
              <a href="#" className="font-semibold text-[#004fc5] underline hover:text-[#003a94]">
                Privacy Notice
              </a>{" "}
              and{" "}
              <a href="#" className="font-semibold text-[#004fc5] underline hover:text-[#003a94]">
                Terms &amp; Conditions
              </a>{" "}
              to understand how your information is used, your rights, and how the service operates.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#004fc5] focus:ring-[#004fc5] cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-700 leading-relaxed">
                  I have read and understood the Privacy Notice and agree to the Terms &amp; Conditions.
                </span>
              </label>
            </div>

            <button
              disabled={!agreed}
              onClick={handleContinue}
              className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-[#004fc5] px-6 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg shadow-blue-500/25 transition hover:bg-[#003a94] disabled:opacity-50 cursor-pointer"
            >
              Continue →
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
