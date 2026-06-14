import { useState } from "react";
import axios from "axios";
import emailjs from "@emailjs/browser";

const API =
  import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

const EMAILJS_SERVICE_ID = "service_6uua9b7";
const EMAILJS_TEMPLATE_ID = "template_ocn365k";
const EMAILJS_PUBLIC_KEY = "_XIs6uup2N4CsgCV8";

export default function KYC({ token, go }) {
  const [nic, setNic] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("nic");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const submitNic = async () => {
    setLoading(true);
    setError("");
    try {
      // ✅ Step 1: Tell backend to generate and store OTP
      const res = await axios.post(
        `${API}/api/kyc/verify-nic`,
        { nic_number: nic },
        { headers },
      );

      const generatedOtp = res.data.otp;
      const userEmail = res.data.email;

      // ✅ Step 2: Send OTP email via EmailJS from frontend
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_email: userEmail,
          otp: generatedOtp,
        },
        EMAILJS_PUBLIC_KEY,
      );

      setStep("otp");
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.detail || "Verification failed");
    }
    setLoading(false);
  };

  const submitOtp = async () => {
    setLoading(true);
    setError("");
    try {
      await axios.post(
        `${API}/api/kyc/verify-otp`,
        { otp_code: otp },
        { headers },
      );
      setStep("done");
    } catch (e) {
      setError(e.response?.data?.detail || "OTP verification failed");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-white rounded-2xl border border-zinc-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      {/* ─── STEP 1: NIC ANCHOR ─── */}
      {step === "nic" && (
        <>
          <div className="text-zinc-500 text-xs font-mono font-bold uppercase tracking-widest mb-2">
            Step 1 · Identity Anchor
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight mb-2">
            Verify your identity
          </h1>
          <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
            Your National Identity Card (NIC) securely links your structural
            credit metrics to a real identity profile.
          </p>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider">
              NIC Number
            </label>
            <input
              className="w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:bg-white transition-all outline-none font-mono text-sm shadow-inner"
              placeholder="199012345678 or 900123456V"
              value={nic}
              onChange={(e) => setNic(e.target.value)}
            />
          </div>

          <div className="text-[11px] text-zinc-400 mt-2 font-mono flex items-center px-1">
            Accepts classic 9-digit + V/X or modern 12-digit format.
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-mono font-semibold">
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={submitNic}
            disabled={loading || !nic}
            className="w-full mt-6 p-4 bg-zinc-950 text-white font-bold rounded-xl hover:bg-zinc-800 transition shadow-[0_4px_12px_rgba(0,0,0,0.1)] disabled:opacity-40 disabled:pointer-events-none active:scale-[0.99] duration-150 text-sm"
          >
            {loading ? "Sending code..." : "Send verification code →"}
          </button>
        </>
      )}

      {/* ─── STEP 2: SECURITY OTP CHECK ─── */}
      {step === "otp" && (
        <>
          <div className="text-zinc-500 text-xs font-mono font-bold uppercase tracking-widest mb-2">
            Step 2 · Security Check
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight mb-2">
            Check your device
          </h1>
          <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
            Enter the 6-digit confirmation code issued to your registered
            security layer.
          </p>

          <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-600 text-xs font-mono mb-5 flex items-center justify-between shadow-inner">
            <span className="text-zinc-400 uppercase tracking-wider font-bold text-[10px]">
              Demo Environment:
            </span>
            <span className="bg-zinc-200 text-zinc-800 px-2 py-0.5 rounded-md font-bold text-xs">
              123456
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider">
              Verification Code
            </label>
            <input
              className="w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 focus:border-zinc-900 focus:bg-white outline-none font-mono text-center text-2xl tracking-[0.4em] font-bold shadow-inner"
              placeholder="000000"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-mono font-semibold">
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={submitOtp}
            disabled={loading || otp.length < 6}
            className="w-full mt-6 p-4 bg-zinc-950 text-white font-bold rounded-xl hover:bg-zinc-800 transition shadow-[0_4px_12px_rgba(0,0,0,0.1)] disabled:opacity-40 disabled:pointer-events-none active:scale-[0.99] duration-150 text-sm"
          >
            {loading ? "Verifying..." : "Verify security token →"}
          </button>
        </>
      )}

      {/* ─── STEP 3: DONE / VERIFIED ─── */}
      {step === "done" && (
        <>
          <div className="text-center">
            <div className="w-14 h-14 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xl mx-auto mb-4 shadow-md">
              ✓
            </div>
            <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight mb-2">
              Identity verified
            </h1>
            <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
              Your identity anchor is active. Platform integrations will now
              measure against this footprint.
            </p>

            <div className="space-y-2 mb-8 text-left">
              {[
                "NIC format validated",
                "Security token confirmed",
                "Identity anchor created",
              ].map((t) => (
                <div
                  key={t}
                  className="flex items-center gap-3 p-3.5 bg-zinc-50 rounded-xl border border-zinc-100"
                >
                  <span className="text-zinc-900 font-bold text-sm font-mono">
                    ✓
                  </span>
                  <span className="text-xs text-zinc-600 font-semibold tracking-tight">
                    {t}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => go("dashboard")}
              className="w-full p-4 bg-zinc-950 text-white font-bold rounded-xl hover:bg-zinc-800 transition shadow-[0_4px_12px_rgba(0,0,0,0.1)] active:scale-[0.99] duration-150 text-sm"
            >
              Go to dashboard →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
