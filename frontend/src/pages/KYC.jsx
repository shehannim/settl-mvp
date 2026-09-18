import { useState } from "react";
import axios from "axios";
import emailjs from "@emailjs/browser";
import OtpInput from "../components/OtpInput.jsx";
import logo from "../assets/Settl Logo.png";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";
const EMAILJS_SERVICE_ID = "service_6uua9b7";
const EMAILJS_TEMPLATE_ID = "template_ocn365k";
const EMAILJS_PUBLIC_KEY = "_XIs6uup2N4CsgCV8";
const DEMO_MODE = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === "true";
const DEMO_OTP = "000000";

export default function KYC({ token, go }) {
  const [stage, setStage] = useState(localStorage.getItem("kyc_verified") === "true" ? "complete" : "nic");
  const [nic, setNic] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState(localStorage.getItem("email") || "your registered email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const headers = { Authorization: `Bearer ${token || localStorage.getItem("token")}` };

  const sendCode = async () => {
    setLoading(true); setError("");
    if (DEMO_MODE) {
      setEmail("demo@settl.local");
      setStage("otp");
      setLoading(false);
      return;
    }
    try {
      const result = await axios.post(`${API}/api/kyc/verify-nic`, { nic_number: nic }, { headers });
      setEmail(result.data.email);
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { to_email: result.data.email, otp: result.data.otp }, EMAILJS_PUBLIC_KEY);
      setStage("otp");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "We could not send a verification code. Please try again.");
    } finally { setLoading(false); }
  };

  const verify = async () => {
    setLoading(true); setError("");
    if (DEMO_MODE && otp === DEMO_OTP) {
      localStorage.setItem("kyc_verified", "true");
      localStorage.setItem("kyc_status", "verified");
      localStorage.setItem("profile_score_refresh", "1");
      setStage("complete");
      setLoading(false);
      return;
    }
    try {
      await axios.post(`${API}/api/kyc/verify-otp`, { otp_code: otp }, { headers });
      localStorage.setItem("kyc_verified", "true");
      localStorage.setItem("kyc_status", "verified");
      localStorage.setItem("profile_score_refresh", "1");
      setStage("complete");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "That code could not be verified.");
    } finally { setLoading(false); }
  };

  if (stage === "complete") return <Complete go={go} />;

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full overflow-hidden bg-white md:grid md:min-h-screen md:grid-cols-2">
        <aside className="relative flex min-h-[48vh] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#004fc5] via-[#003a94] to-[#002661] p-8 text-white md:min-h-screen md:p-12">
          <div>
            <div className="flex items-center gap-3">
              <img src={logo} alt="Settl" className="h-10 sm:h-12 w-auto object-contain" />
            </div>
            <h2 className="mt-8 text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">Instant Verification.<br /><span className="text-teal-300">Zero Friction.</span></h2>
            <p className="mt-4 text-base lg:text-lg leading-relaxed text-blue-100">We use your NIC and verified email to authenticate your identity in seconds.</p>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-2.5 text-xs"><Step active label="01 Account" /><Step active={stage === "otp"} label="02 Verify" /><Step label="03 Profile" /></div>
        </aside>
        <section className="flex min-h-[52vh] flex-col justify-between p-8 md:min-h-screen md:p-12">
          <button onClick={() => go("auth")} className="self-start text-xs font-medium text-slate-400 transition hover:text-[#004fc5]">← Back to sign in</button>
          {stage === "nic" ? <NicForm nic={nic} setNic={setNic} sendCode={sendCode} loading={loading} error={error} demoMode={DEMO_MODE} /> : <OtpForm email={email} otp={otp} setOtp={setOtp} verify={verify} loading={loading} error={error} resend={sendCode} demoMode={DEMO_MODE} />}
        </section>
      </div>
    </div>
  );
}

function Step({ active, label }) { return <div className={`rounded-xl p-3 ${active ? "bg-white text-slate-900" : "bg-white/10 text-blue-200"}`}><strong className="block text-[11px] uppercase tracking-wider">{active ? "✓" : ""} {label.split(" ")[0]}</strong><span className="mt-0.5 block truncate font-semibold text-xs">{label.slice(3)}</span></div>; }
function NicForm({ nic, setNic, sendCode, loading, error, demoMode }) { return <div className="mx-auto my-10 w-full max-w-md"><span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#004fc5]">Identity verification</span><h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900">Verify your identity</h1><p className="mt-2 text-sm leading-relaxed text-slate-500">Enter your National Identity Card number to receive a six-digit code at your registered email.</p><label htmlFor="nic" className="mt-8 mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700">NIC number</label><input id="nic" value={nic} onChange={(event) => setNic(event.target.value)} placeholder="199012345678 or 900123456V" className="w-full rounded-xl border border-slate-200 px-4 py-3.5 font-mono text-sm outline-none focus:border-[#004fc5] focus:ring-4 focus:ring-blue-100" /><p className="mt-1.5 text-[11px] text-slate-400">Accepts classic 9-digit + V/X or modern 12-digit format.</p>{demoMode && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">Development mode: any NIC is accepted and no email is sent.</p>}{error && <Error text={error} />}<button disabled={loading || !nic} onClick={sendCode} className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-[#004fc5] px-6 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg shadow-blue-500/25 transition hover:bg-[#003a94] disabled:opacity-60">{loading ? "Sending code…" : "Send verification code →"}</button></div>; }
function OtpForm({ email, otp, setOtp, verify, loading, error, resend, demoMode }) { return <div className="mx-auto my-10 w-full max-w-md"><h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Check your email</h1><p className="mt-2 text-sm leading-relaxed text-slate-500">We sent a 6-digit confirmation code to <span className="font-semibold text-slate-800">{email}</span>.</p><div className="mt-8"><OtpInput value={otp} onChange={setOtp} onComplete={setOtp} /></div><div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs"><div className="flex justify-between text-slate-500"><span>{demoMode ? "Development verification code" : "Didn't receive the code?"}</span><button onClick={resend} disabled={loading || demoMode} className="font-bold text-[#004fc5] hover:underline disabled:opacity-50">{demoMode ? DEMO_OTP : "Resend code"}</button></div><p className="mt-3 text-slate-500">{demoMode ? "Enter 000000 to continue through onboarding." : "Verification is sent to your registered email address."}</p></div>{error && <Error text={error} />}<button disabled={loading || otp.length !== 6} onClick={verify} className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-[#004fc5] px-6 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg shadow-blue-500/25 transition hover:bg-[#003a94] disabled:opacity-60">{loading ? "Verifying…" : "Verify & Continue →"}</button></div>; }
function Error({ text }) { return <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{text}</p>; }
function Complete({ go }) { return <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-6"><div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-10 text-center shadow-xl shadow-slate-200/60"><img src={logo} alt="Settl" className="mx-auto h-11 sm:h-12 w-auto object-contain" /><div className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-2xl font-bold text-teal-600">✓</div><h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900">Identity verified</h1><p className="mt-2 text-sm leading-relaxed text-slate-500">Your verified financial identity is ready. Complete a few profile details next.</p><button onClick={() => go("personal-details")} className="mt-8 flex w-full items-center justify-center rounded-full bg-[#004fc5] px-6 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg shadow-blue-500/25 transition hover:bg-[#003a94]">Continue to profile →</button></div></div>; }
