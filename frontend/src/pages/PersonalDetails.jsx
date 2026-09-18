import { useState } from "react";
import logoBlack from "../assets/Settl Logo Black.png";

const steps = [
  { num: "01", name: "Personal Details", detail: "Legal verification", status: "active" },
  { num: "02", name: "Income Streams", detail: "Link gig accounts", status: "pending" },
  { num: "03", name: "Score Calibration", detail: "Alternative credit baseline", status: "pending" },
];

const locations = ["Western — Colombo", "Western — Gampaha", "Central — Kandy", "Southern — Galle", "Northern — Jaffna"];

export default function PersonalDetails({ go }) {
  const [profile, setProfile] = useState(() =>
    JSON.parse(
      localStorage.getItem("onboarding_profile") ||
        '{"nic":"","phone":"","location":"Western — Colombo"}'
    )
  );
  const [error, setError] = useState("");

  const update = (key) => (event) => {
    setError("");
    setProfile((current) => ({ ...current, [key]: event.target.value }));
  };

  const validateNic = (nic) => {
    const trimmed = (nic || "").trim();
    // Sri Lanka NIC format: classic 9 digits + V/X/v/x or modern 12 digits
    const classicRegex = /^[0-9]{9}[vVxX]$/;
    const modernRegex = /^[0-9]{12}$/;
    return classicRegex.test(trimmed) || modernRegex.test(trimmed);
  };

  const saveProfileData = () => {
    localStorage.setItem("onboarding_profile", JSON.stringify(profile));
    if (profile.nic) localStorage.setItem("nic_number", profile.nic.trim());
  };

  const handleSkipToDashboard = () => {
    saveProfileData();
    go("dashboard");
  };

  const handleSaveAndContinue = (e) => {
    e.preventDefault();
    if (profile.nic && !validateNic(profile.nic)) {
      setError("Please enter a valid Sri Lankan NIC (9 digits + V/X or modern 12 digits).");
      return;
    }
    saveProfileData();
    go("income-streams");
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
              Personal Details
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-blue-100 lg:text-base">
              We only need the identity basics to issue your alternative credit report.
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
                    </div>
                    <p className="text-xs text-blue-200/90 mt-0.5 truncate">{step.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative z-10">
            <span className="text-xs font-medium text-blue-200/80">Step 1 of 3 · Profile Verification</span>
          </div>
        </section>

        {/* Right Content Column */}
        <section className="flex min-h-[54vh] flex-1 flex-col justify-between overflow-y-auto p-6 sm:p-8 lg:min-h-0 lg:px-10 lg:py-12 xl:px-14">
          <div className="mx-auto w-full max-w-xl">
            <div className="border-b border-slate-100 pb-5">
              <img
                src={logoBlack}
                alt="Settl"
                className="mb-5 h-10 sm:h-12 w-auto object-contain lg:hidden"
              />
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Let&apos;s get started</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">Just the basics for now — you can fill in the rest later.</p>
            </div>

            <form onSubmit={handleSaveAndContinue} className="mt-8 space-y-6">
              <div>
                <label htmlFor="nic" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700">
                  National Identity Card (NIC) Number
                </label>
                <input
                  id="nic"
                  value={profile.nic || ""}
                  onChange={update("nic")}
                  placeholder="199012345678 or 900123456V"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 font-mono text-sm font-medium text-slate-900 outline-none transition-all focus:border-[#004fc5] focus:ring-4 focus:ring-blue-100"
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Accepts classic 9-digit + V/X or modern 12-digit format.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
                <p className="border-b border-slate-200/60 pb-3 text-xs font-bold uppercase tracking-wider text-slate-700">More details</p>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="phone" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700">Phone number</label>
                    <input
                      id="phone"
                      value={profile.phone || ""}
                      onChange={update("phone")}
                      placeholder="77 412 8901"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition-all focus:border-[#004fc5] focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="location" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700">Residential Province / City</label>
                    <select
                      id="location"
                      value={profile.location}
                      onChange={update("location")}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition-all focus:border-[#004fc5] focus:ring-4 focus:ring-blue-100"
                    >
                      {locations.map((place) => <option key={place}>{place}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              <div className="mt-10 flex items-center justify-between border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={handleSkipToDashboard}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 transition cursor-pointer"
                >
                  Continue to Dashboard
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-[#004fc5] px-7 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg shadow-blue-500/25 transition hover:bg-[#003a94] cursor-pointer"
                >
                  Save &amp; Continue
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
