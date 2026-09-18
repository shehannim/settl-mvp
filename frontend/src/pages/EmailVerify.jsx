import { useState } from "react";
import OtpInput from "../components/OtpInput.jsx";
import logo from "../assets/Settl Logo.png";

const DEMO_MODE = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === "true";
const DEMO_OTP = "000000";

export default function EmailVerify({ go, onVerified }) {
  const email = localStorage.getItem("email") || "your registered email";
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    setError("");

    if (DEMO_MODE && otp === DEMO_OTP) {
      localStorage.setItem("email_verified", "true");
      setLoading(false);
      if (onVerified) onVerified();
      else go("consent");
      return;
    }

    if (otp.length === 6) {
      localStorage.setItem("email_verified", "true");
      setLoading(false);
      if (onVerified) onVerified();
      else go("consent");
      return;
    }

    setError("Please enter the 6-digit confirmation code.");
    setLoading(false);
  };

  const handleResend = () => {
    setError("");
    alert(`Verification code re-sent to ${email}`);
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
              ["02 OTP", "Instant Verification", true, false],
              ["03 DPA", "Data Consent", false, false],
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

        {/* Right OTP Column */}
        <section className="flex min-h-[48vh] flex-1 flex-col justify-between overflow-y-auto p-6 sm:p-8 lg:min-h-0 lg:px-10 lg:py-12 xl:px-14">
          <button
            onClick={() => go("auth")}
            className="self-start text-xs font-medium text-slate-400 transition hover:text-[#004fc5] cursor-pointer"
          >
            ← Back to sign in
          </button>

          <div className="mx-auto my-auto w-full max-w-md py-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Check your email
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              We sent a 6-digit confirmation code to{" "}
              <span className="font-semibold text-slate-800">{email}</span>.
            </p>

            <div className="mt-8">
              <OtpInput value={otp} onChange={setOtp} onComplete={setOtp} />
            </div>

            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>
                  {DEMO_MODE ? "Development verification code" : "Didn't receive the code?"}
                </span>
                <button
                  onClick={handleResend}
                  disabled={loading || DEMO_MODE}
                  className="font-bold text-[#004fc5] hover:underline disabled:opacity-50 cursor-pointer"
                >
                  {DEMO_MODE ? DEMO_OTP : "Resend code"}
                </button>
              </div>
              <p className="mt-3 text-slate-500">
                {DEMO_MODE
                  ? "Enter 000000 to continue through onboarding."
                  : "Verification is sent to your registered email address."}
              </p>
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <button
              disabled={loading || otp.length !== 6}
              onClick={handleVerify}
              className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-[#004fc5] px-6 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg shadow-blue-500/25 transition hover:bg-[#003a94] disabled:opacity-60 cursor-pointer"
            >
              {loading ? "Verifying…" : "Verify & Continue →"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
