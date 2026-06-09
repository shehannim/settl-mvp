import { useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

export default function KYC({ token, go }) {
  const [nic, setNic] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("nic");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const submitNic = async () => {
    setLoading(true);
    setError("");
    try {
      await axios.post(`${API}/api/kyc/verify-nic`, { nic_number: nic }, { headers });
      setStep("otp");
    } catch (e) {
      setError(e.response?.data?.detail || "NIC verification failed");
    }
    setLoading(false);
  };

  const submitOtp = async () => {
    setLoading(true);
    setError("");
    try {
      await axios.post(`${API}/api/kyc/verify-otp`, { otp_code: otp }, { headers });
      setVerified(true);
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
          <h1 className="text-2xl font-bold mb-2">Check your phone</h1>
          <p className="text-gray-400 text-sm mb-6">Enter the 6-digit code sent to your registered mobile number.</p>
          <div className="p-3 bg-emerald-400/10 border border-emerald-400/30 rounded-lg text-emerald-400 text-sm font-mono mb-4">
            DEMO: use code 123456
          </div>
          <label className="text-xs text-gray-400 font-mono uppercase">Verification code</label>
          <input
            className="w-full mt-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-emerald-400 outline-none font-mono text-center text-2xl tracking-widest"
            placeholder="123456"
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
            <p className="text-gray-400 text-sm mb-8">Your identity is now anchored to your NIC. All connected data will be verified against this identity.</p>
            <div className="space-y-2 mb-8 text-left">
              {["NIC format validated", "Mobile number confirmed", "Identity anchor created"].map(t => (
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