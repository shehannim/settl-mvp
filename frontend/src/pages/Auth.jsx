import { useState } from "react";
import axios from "axios";
import logo from "../assets/Settl Logo.png";

const API =
  import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState("register");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isRegister = mode === "register";

  // SSO integrations
  const onGoogleAuth = () => {
    // TODO: Wire to Google OAuth provider
    // Google SSO verifies email automatically, bypassing OTP to PDPA Data Consent
    onAuthenticated({
      accessToken: "demo_google_sso_token",
      id: "demo_google_user",
      email: "google.user@example.com",
      name: "Google User",
      signupMethod: "google",
    });
  };

  const onAppleAuth = () => {
    // TODO: Wire to Apple OAuth provider
    // Apple SSO verifies email automatically, bypassing OTP to PDPA Data Consent
    onAuthenticated({
      accessToken: "demo_apple_sso_token",
      id: "demo_apple_user",
      email: "apple.user@example.com",
      name: "Apple User",
      signupMethod: "apple",
    });
  };

  const update = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (isRegister && (!form.firstName.trim() || !form.lastName.trim())) {
      return setError("Please enter both your first and last name.");
    }
    if (!form.email.trim()) return setError("Please enter your email address.");
    if (!form.password || form.password.length < 8)
      return setError("Password must be at least 8 characters.");

    setLoading(true);
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    try {
      const payload = isRegister
        ? {
            full_name: fullName,
            email: form.email.trim(),
            password: form.password,
          }
        : { email: form.email.trim(), password: form.password };
      const response = await axios.post(
        `${API}/api/auth/${isRegister ? "register" : "login"}`,
        payload,
      );
      onAuthenticated({
        accessToken: response.data.access_token,
        id: response.data.user_id,
        email: form.email.trim(),
        name: isRegister ? fullName : "",
        signupMethod: "email",
        isRegister,
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "We could not reach Settl. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="flex min-h-screen w-full flex-col overflow-hidden bg-white lg:h-screen lg:min-h-0 lg:flex-row">
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
              ["01 Account", "Create Profile", true],
              ["02 OTP", "Instant Verification", false],
              ["03 DPA", "Data Consent", false],
            ].map(([step, detail, active]) => (
              <div
                key={step}
                className={`rounded-xl border p-3 transition-all ${
                  active
                    ? "border-white/40 bg-white/20 shadow-xs"
                    : "border-white/10 bg-white/10 opacity-75"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-blue-200">
                  {step}
                </p>
                <p className="mt-1 text-xs font-semibold">{detail}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="flex min-h-[48vh] flex-1 flex-col justify-center overflow-y-auto p-6 sm:p-8 lg:min-h-0 lg:px-10 lg:py-12 xl:px-14">
          <div className="mx-auto w-full max-w-md py-4">
            <form onSubmit={submit} className="w-full">
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                {isRegister ? "Create your account" : "Welcome back"}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                {isRegister
                  ? "Start establishing your portable freelancer credit score in under two minutes."
                  : "Sign in to continue building your portable credit profile."}
              </p>
              <div className="mt-5 space-y-2.5">
                {isRegister && (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <Field
                      label="First name"
                      value={form.firstName}
                      onChange={update("firstName")}
                      placeholder="Kasun"
                      autoComplete="given-name"
                    />
                    <Field
                      label="Last name"
                      value={form.lastName}
                      onChange={update("lastName")}
                      placeholder="Perera"
                      autoComplete="family-name"
                    />
                  </div>
                )}
                <Field
                  label="Work or personal email"
                  type="email"
                  value={form.email}
                  onChange={update("email")}
                  placeholder="you@domain.com"
                  autoComplete="email"
                  helper={
                    isRegister
                      ? "Use the email linked to your gig accounts when possible."
                      : undefined
                  }
                />
                <Field
                  label="Password"
                  type="password"
                  value={form.password}
                  onChange={update("password")}
                  placeholder="At least 8 characters"
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                />
              </div>
              {error && (
                <p
                  role="alert"
                  className="mt-3.5 rounded-xl border border-red-200 bg-red-50 p-2.5 text-sm font-medium text-red-700"
                >
                  {error}
                </p>
              )}
              <button
                disabled={loading}
                className="mt-5 flex w-full items-center justify-center rounded-full bg-[#004fc5] px-6 py-3 text-sm font-bold tracking-wide text-white shadow-lg shadow-blue-500/25 transition hover:bg-[#003a94] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {loading ? "Please wait…" : "Continue"}
              </button>

              {/* Divider */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="w-full border-t border-slate-200" />
                <span className="absolute  px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  or
                </span>
              </div>

              {/* Secondary SSO buttons */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={onGoogleAuth}
                  className="relative flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
                >
                  <span className="absolute left-5 flex items-center">
                    <GoogleIcon />
                  </span>
                  <span>Continue with Google</span>
                </button>
                <button
                  type="button"
                  onClick={onAppleAuth}
                  className="relative flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
                >
                  <span className="absolute left-5 flex items-center">
                    <AppleIcon />
                  </span>
                  <span>Continue with Apple</span>
                </button>
              </div>

              {/* Toggle link */}
              <div className="mt-5 text-center">
                <p className="text-sm text-slate-500">
                  {isRegister ? "Already have an account?" : "New here?"}{" "}
                  <button
                    type="button"
                    onClick={() =>
                      switchMode(isRegister ? "login" : "register")
                    }
                    className="font-bold text-[#004fc5] hover:underline cursor-pointer ml-1"
                  >
                    {isRegister ? "Log in" : "Create an account"}
                  </button>
                </p>
              </div>

              {isRegister && (
                <p className="mt-4 text-center text-xs leading-relaxed text-slate-400">
                  By signing up, you agree to Settl&apos;s{" "}
                  <a href="#" className="font-medium text-slate-600 underline">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="#" className="font-medium text-slate-600 underline">
                    Privacy Policy
                  </a>
                  .
                </p>
              )}
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({ label, helper, ...props }) {
  const id = label.replaceAll(" ", "-").toLowerCase();
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700"
      >
        {label}
      </label>
      <input
        id={id}
        required
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#004fc5] focus:ring-4 focus:ring-blue-100"
        {...props}
      />
      {helper && <p className="mt-1 text-[11px] text-slate-400">{helper}</p>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-slate-900"
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 1.01-2.87-.96.04-2.12.65-2.8 1.44-.55.63-1.03 1.66-.9 2.68 1.07.08 2.15-.55 2.69-1.25z" />
    </svg>
  );
}
