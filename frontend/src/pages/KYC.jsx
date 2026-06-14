import { useState } from "react";
import axios from "axios";
import emailjs from "@emailjs/browser";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

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
        { headers }
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
        EMAILJS_PUBLIC_KEY
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
      await axios.post(`${API}/api/kyc/verify-otp`, { otp_code: otp }, { headers });
      setStep("done");
    } catch (e) {
      setError(e.response?.data?.detail || "OTP verification failed");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-gray-900 rounded-2xl border border-gray-800">

      {step === "nic" && (
        <>
          <div className="text-emerald-400 text-sm font-mono mb-2">STEP 2 · KYC</div>
          <h1 className="text-2xl font-bold mb-2">Verify your identity</h1>
          <p className="text-gray-400 text-sm mb-6">Your NIC anchors your financial profile to a real person.</p>
          <label className="text-xs text-gray-400 font-mono uppercase">NIC Number</label>
          <input
            className="w-full mt-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-emerald-400 outline-none font-mono"
            placeholder="199012345678 or 900123456V"
            value={nic}
            onChange={e => setNic(e.target.value)}
          />
          <div className="text-xs text-gray-500 mt-2 font-mono">Accepts old 9-digit + V/X or new 12-digit format</div>
          {error && <div className="mt-3 text-red-400 text-sm font-mono">{error}</div>}
          <button
            onClick={submitNic}
            disabled={loading || !nic}
            className="w-full mt-6 p-4 bg-emerald-400 text-gray-950 font-bold rounded-xl hover:bg-emerald-300 transition disabled:opacity-50"
          >
            {loading ? "Sending code..." : "Send verification code →"}
          </button>
        </>
      )}

      {step === "otp" && (
        <>
          <div className="text-emerald-400 text-sm font-mono mb-2">STEP 2 · KYC</div>
          <h1 className="text-2xl font-bold mb-2">Check your email</h1>
          <p className="text-gray-400 text-sm mb-6">Enter the 6-digit code sent to your email address.</p>
          <label className="text-xs text-gray-400 font-mono uppercase">Verification code</label>
          <input
            className="w-full mt-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-emerald-400 outline-none font-mono text-center text-2xl tracking-widest"
            placeholder="______"
            maxLength={6}
            value={otp}
            onChange={e => setOtp(e.target.value)}
          />
          {error && <div className="mt-3 text-red-400 text-sm font-mono">{error}</div>}
          <button
            onClick={submitOtp}
            disabled={loading || otp.length < 6}
            className="w-full mt-6 p-4 bg-emerald-400 text-gray-950 font-bold rounded-xl hover:bg-emerald-300 transition disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify code →"}
          </button>
        </>
      )}

      {step === "done" && (
        <>
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold mb-2">Identity verified</h1>
            <p className="text-gray-400 text-sm mb-8">Your identity is now anchored to your NIC.</p>
            <div className="space-y-2 mb-8 text-left">
              {["NIC format validated", "Email confirmed", "Identity anchor created"].map(t => (
                <div key={t} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
                  <span className="text-emerald-400 font-mono">✓</span>
                  <span className="text-sm text-gray-300 font-mono">{t}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => go("dashboard")}
              className="w-full p-4 bg-emerald-400 text-gray-950 font-bold rounded-xl hover:bg-emerald-300 transition"
            >
              Go to dashboard →
            </button>
          </div>
        </>
      )}
    </div>
  );
}