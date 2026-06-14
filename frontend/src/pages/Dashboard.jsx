import { useState, useEffect } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

export default function Dashboard({ token, userId, go }) {
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [error, setError] = useState("");

  const [file, setFile] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [sources, setSources] = useState([]);

  const authToken = token || localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${authToken}` };

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    setSourcesLoading(true);

    try {
      const res = await axios.get(`${API}/api/connect/sources`, { headers });
      setSources(res.data.sources || []);
    } catch (e) {
      console.error("Failed to load sources", e);
    }

    setSourcesLoading(false);
  };

  const paypal = sources.find((s) => s.source === "paypal");

  const computeScore = async () => {
    setLoading(true);
    setError("");

    try {
      await axios.post(`${API}/api/score/compute`, {}, { headers });
      const res = await axios.get(`${API}/api/score/result`, { headers });
      setScore(res.data);
    } catch (e) {
      console.error("Score error:", e);
      setError(e.response?.data?.detail || "Could not compute score");
    }

    setLoading(false);
  };

  const uploadBill = async () => {
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await axios.post(`${API}/api/ingest/utility-bill`, form, {
        headers: {
          ...headers,
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("OCR RESPONSE FROM BACKEND:", res.data);

      if (res.data?.fields) {
        console.table(res.data.fields);
      } else {
        console.warn("No fields returned from OCR response");
      }

      setOcrResult(res.data);
    } catch (e) {
      console.error("UPLOAD ERROR:", e);
      console.error("UPLOAD BACKEND RESPONSE:", e.response?.data);
      setError(e.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const bandColor = (band) => {
    if (!band) return "text-zinc-400";
    if (band === "excellent") return "text-emerald-600";
    if (band === "good") return "text-emerald-600";
    if (band === "fair") return "text-yellow-600";
    return "text-red-600";
  };

  const normalizeCategories = (categories) => {
    if (!categories) return [];

    if (Array.isArray(categories)) return categories;

    if (typeof categories === "object") {
      return Object.entries(categories).map(([category, value]) => ({
        category,
        score: typeof value === "number" ? value : Number(value) || 0,
      }));
    }

    return [];
  };

  const normalizeOcrFields = (fields) => {
    if (!fields) return [];

    if (Array.isArray(fields)) {
      return fields.map((field, index) => {
        if (typeof field === "string") {
          return {
            field_name: `field_${index + 1}`,
            extracted_value: field,
            confidence: undefined,
          };
        }

        return {
          field_name:
            field.field_name ||
            field.name ||
            field.key ||
            field.label ||
            `field_${index + 1}`,
          extracted_value:
            field.extracted_value ??
            field.value ??
            field.text ??
            field.result ??
            "",
          confidence: field.confidence,
        };
      });
    }

    if (typeof fields === "object") {
      return Object.entries(fields).map(([key, value]) => ({
        field_name: key,
        extracted_value:
          typeof value === "object" && value !== null
            ? (value.extracted_value ?? value.value ?? JSON.stringify(value))
            : value,
        confidence:
          typeof value === "object" && value !== null
            ? value.confidence
            : undefined,
      }));
    }

    return [];
  };

  const categories = normalizeCategories(score?.categories);
  const extractedFields = normalizeOcrFields(ocrResult?.fields);

  const rawOcrText =
    ocrResult?.raw_text ||
    ocrResult?.ocr_text ||
    ocrResult?.text ||
    ocrResult?.raw ||
    "";

  const profileCompletion = () => {
    let completed = 0;
    if (paypal) completed += 35;
    if (ocrResult) completed += 35;
    if (score) completed += 30;
    return completed;
  };

  const completion = profileCompletion();

  return (
    <div className="max-w-6xl mx-auto px-4 space-y-8 font-sans text-zinc-900">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-zinc-400 text-xs font-semibold tracking-wider mb-2 uppercase">
            SETTL FINANCIAL PROFILE
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900">
            Welcome Back!
          </h1>

          <p className="text-zinc-500 mt-2 max-w-xl text-sm leading-relaxed">
            Your alternative credit profile is built from verified digital
            income, utility payment behavior, and identity-linked financial
            signals.
          </p>
        </div>

        <div className="bg-white border border-zinc-200 shadow-sm rounded-2xl p-4 min-w-55">
          <div className="text-xs text-zinc-400 font-medium tracking-wider mb-1 uppercase">
            PROFILE COMPLETION
          </div>

          <div className="flex items-end justify-between mb-2">
            <div className="text-3xl font-bold text-zinc-900">
              {completion}%
            </div>

            <div className="text-xs text-zinc-400">verified</div>
          </div>

          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-zinc-900 rounded-full transition-all duration-700"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      </div>

      {/* Top status cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-7xl mx-auto mt-8">
        <div className="md:col-span-2 opacity-0 animate-card-1 will-change-transform">
          <StatusCard
            title="Credit Score"
            label={score ? "Calculated" : "Not calculated"}
            value={score ? score.score : "Pending"}
            color={score ? "emerald" : "gray"}
            icon="⚡"
            isFeatured={true} // ✨ Triggers the high-contrast midnight UI code
          />
        </div>
        <div className="opacity-0 animate-card-1 will-change-transform">
          <StatusCard
            title="PayPal"
            label={paypal ? "Connected" : "Not connected"}
            value={paypal ? "Active" : "Pending"}
            color={paypal ? "emerald" : "blue"}
            icon="💰"
          />
        </div>
        <div className="opacity-0 animate-card-2 will-change-transform">
          <StatusCard
            title="Utility Bill"
            label={ocrResult ? "Uploaded" : "Not uploaded"}
            value={ocrResult ? "Verified" : "Pending"}
            color={ocrResult ? "emerald" : "yellow"}
            icon="🧾"
          />
        </div>
      </div>
      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* PayPal panel */}
          <div className="p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm opacity-0 animate-card-3 will-change-transform">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-zinc-400 text-xs font-medium tracking-wider mb-2 uppercase">
                  STEP 2 · INCOME SOURCE
                </div>

                <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
                  PayPal Integration
                </h2>

                <p className="text-zinc-500 text-sm mt-1 leading-relaxed">
                  Used to analyse freelance income, transaction history, and
                  earning consistency.
                </p>
              </div>

              <button
                onClick={loadSources}
                className="text-xs px-3 py-2 rounded-lg border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 transition"
              >
                Refresh
              </button>
            </div>

            {sourcesLoading ? (
              <div className="text-zinc-400 text-sm">
                Loading PayPal status...
              </div>
            ) : paypal ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MetricCard
                  label="Account"
                  value={paypal.account_name || "PayPal user"}
                />

                <MetricCard
                  label="Transactions"
                  value={paypal.transaction_count ?? 0}
                />

                <MetricCard
                  label="Active Months"
                  value={paypal.date_range_months ?? 0}
                />

                <div className="sm:col-span-3 mt-2 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="text-emerald-700 text-sm font-medium">
                    ✅ PayPal already connected
                  </div>

                  <div className="text-zinc-500 text-xs mt-1">
                    This income source will be included when calculating your
                    score.
                  </div>
                </div>
              </div>
            ) : (
              /* PRESERVED YELLOW THEME CONTAINER */
              <div className="p-5 rounded-xl bg-yellow-400/5 border border-yellow-400/20">
                <div className="text-yellow-600 font-mono text-sm mb-2">
                  ⚠️ PayPal not connected
                </div>

                <p className="text-gray-400 text-sm mb-4">
                  Connect PayPal to improve your score confidence and income
                  stability analysis.
                </p>

                <button
                  onClick={() => go && go("paypal-connect")}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#003087]  font-bold hover:bg-[#002060] transition text-white"
                >
                  <span>Connect PayPal </span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M7.5 21H3L6 3h7c2.5 0 5 1.5 4.5 5C17 10.5 14 12 11.5 12H9L7.5 21Z"
                      fill="#009cde"
                    ></path>
                    <path
                      d="M10.5 21H6L9 3h7c2.5 0 5 1.5 4.5 5C20 10.5 17 12 14.5 12H12L10.5 21Z"
                      fill="#012169"
                      opacity="0.8"
                    ></path>
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Upload bill */}
          <div className="p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm opacity-0 animate-card-4 will-change-transform">
            <div className="text-zinc-400 text-xs font-medium tracking-wider mb-2 uppercase">
              STEP 3 · UTILITY BILL
            </div>

            <h2 className="text-xl font-bold text-zinc-900 tracking-tight mb-2">
              Upload a utility bill
            </h2>

            <p className="text-zinc-500 text-sm mb-5 leading-relaxed">
              Upload a CEB, Dialog, Water Board, or similar bill. Settl extracts
              payment behavior using OCR.
            </p>

            <div
              onClick={() => document.getElementById("billInput").click()}
              className="border-2 border-dashed border-zinc-200 rounded-2xl p-10 text-center cursor-pointer hover:border-zinc-900 hover:bg-zinc-50 transition"
            >
              {file ? (
                <div>
                  <div className="text-4xl mb-3">📄</div>

                  <div className="text-zinc-900 font-medium text-sm">
                    {file.name} ✓
                  </div>

                  <div className="text-zinc-400 text-xs mt-1">
                    Ready to extract bill data
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-4xl mb-3">⬆️</div>

                  <div className="text-zinc-600 font-medium">
                    Click to select a PDF bill
                  </div>

                  <div className="text-zinc-400 text-xs mt-1">
                    PDF only · OCR enabled · encrypted processing
                  </div>
                </div>
              )}
            </div>

            <input
              id="billInput"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files[0])}
            />

            <button
              onClick={uploadBill}
              disabled={!file || uploading}
              className="w-full mt-4 p-4 bg-zinc-900 text-white font-semibold rounded-xl hover:bg-zinc-800 transition disabled:opacity-50 tracking-wide"
            >
              {uploading ? "Extracting bill data..." : "Extract bill data →"}
            </button>
          </div>

          {/* OCR result viewer */}
          {ocrResult && (
            <div className="p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
                <div>
                  <div className="text-zinc-400 text-xs font-medium tracking-wider mb-1 uppercase">
                    OCR RESULT
                  </div>

                  <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">
                    {ocrResult.biller_detected ||
                      ocrResult.biller ||
                      ocrResult.provider ||
                      "Unknown biller"}
                  </h2>

                  <p className="text-zinc-500 text-sm mt-1">
                    Review the extracted fields and raw OCR text below.
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-xs text-zinc-400 font-medium tracking-wider uppercase">
                    CONFIDENCE
                  </div>

                  <div className="text-zinc-900 text-2xl font-bold tracking-tight">
                    {ocrResult.overall_confidence !== undefined &&
                    ocrResult.overall_confidence !== null
                      ? `${(Number(ocrResult.overall_confidence) * 100).toFixed(0)}%`
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Extracted fields */}
              <div className="mb-6">
                <div className="text-xs text-zinc-400 font-medium tracking-wider mb-3 uppercase">
                  EXTRACTED FIELDS
                </div>

                {extractedFields.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {extractedFields.map((f, index) => (
                      <div
                        key={`${f.field_name}-${index}`}
                        className="p-4 bg-zinc-50 rounded-xl border border-zinc-200"
                      >
                        <div className="text-zinc-400 text-xs font-medium tracking-wider mb-1 uppercase">
                          {(f.field_name || "unknown field").replace(/_/g, " ")}
                        </div>

                        <div className="text-zinc-900 text-sm font-medium wrap-break-word">
                          {f.extracted_value !== undefined &&
                          f.extracted_value !== null &&
                          String(f.extracted_value).trim() !== ""
                            ? String(f.extracted_value)
                            : "Not detected"}
                        </div>

                        {f.confidence !== undefined &&
                          f.confidence !== null && (
                            <div className="text-xs text-emerald-600 mt-2 font-medium">
                              Confidence:{" "}
                              {(Number(f.confidence) * 100).toFixed(0)}%
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* PRESERVED YELLOW THEME CONTAINER */
                  <div className="p-4 bg-yellow-400/5 border border-yellow-400/20 rounded-xl text-yellow-400 text-sm">
                    No structured fields were detected. Check the raw OCR text
                    below.
                  </div>
                )}
              </div>

              {/* Raw OCR text */}
              <div>
                <div className="text-xs text-zinc-400 font-medium tracking-wider mb-3 uppercase">
                  RAW OCR TEXT
                </div>

                <div className="max-h-72 overflow-y-auto p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <pre className="text-zinc-700 text-xs whitespace-pre-wrap font-sans leading-relaxed">
                    {rawOcrText || "No raw OCR text returned from backend."}
                  </pre>
                </div>
              </div>

              {/* Full debug JSON */}
              <details className="mt-5">
                <summary className="cursor-pointer text-xs text-zinc-400 font-medium hover:text-zinc-900 transition">
                  SHOW FULL OCR JSON DEBUG
                </summary>

                <pre className="mt-3 max-h-72 overflow-y-auto p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-700 text-xs whitespace-pre-wrap font-sans">
                  {JSON.stringify(ocrResult, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Score action */}
          <div className="p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm sticky top-6 opacity-0 animate-card-4 will-change-transform">
            <div className="text-zinc-400 text-xs font-medium tracking-wider mb-2 uppercase">
              STEP 4 · SCORE
            </div>

            <h2 className="text-xl font-bold text-zinc-900 tracking-tight mb-2">
              Calculate your score
            </h2>

            <p className="text-zinc-500 text-sm mb-5 leading-relaxed">
              Your score will combine connected sources, bill history, and
              identity consistency.
            </p>

            {error && (
              <div className="mb-4 text-red-600 text-sm p-3 rounded-xl bg-red-50 border border-red-100">
                {error}
              </div>
            )}

            <button
              onClick={computeScore}
              disabled={loading}
              className="w-full p-4 bg-zinc-900 text-white font-semibold rounded-xl hover:bg-zinc-800 transition disabled:opacity-50 tracking-wide"
            >
              {loading ? "Calculating..." : "Calculate my score →"}
            </button>
          </div>

          {/* Score result */}
          {score && (
            <div className="p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm">
              <div className="text-center mb-6">
                <div className="text-xs text-zinc-400 font-medium tracking-wider mb-2 uppercase">
                  YOUR CREDIT SCORE
                </div>

                <div className="text-7xl font-bold tracking-tight text-zinc-900">
                  {score.score}
                </div>

                <div
                  className={`text-xl font-bold mt-2 capitalize ${bandColor(score.band)}`}
                >
                  {score.band}
                </div>

                <div className="text-zinc-400 text-xs mt-2 font-medium tracking-wide">
                  300 ──── {score.score} ──── 850
                </div>
              </div>

              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 mb-5">
                <div className="text-xs text-zinc-400 font-medium tracking-wider uppercase">
                  Confidence
                </div>

                <div className="text-2xl font-bold text-zinc-900 mt-0.5">
                  {(score.confidence * 100).toFixed(0)}%
                </div>

                <div className="h-2 bg-zinc-200 rounded-full overflow-hidden mt-3">
                  <div
                    className="h-full bg-zinc-900 rounded-full"
                    style={{ width: `${score.confidence * 100}%` }}
                  />
                </div>
              </div>

              {categories.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs text-zinc-400 font-medium tracking-wider mb-2 uppercase">
                    SCORE BREAKDOWN
                  </div>

                  {categories.map((c) => (
                    <div key={c.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-zinc-500 capitalize">
                          {c.category.replace(/_/g, " ")}
                        </span>

                        <span className="text-zinc-900 font-semibold">
                          {Number(c.score).toFixed(0)}%
                        </span>
                      </div>

                      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-zinc-900 rounded-full"
                          style={{ width: `${Number(c.score)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      {score && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {score.top_positive_factors?.length > 0 && (
            <InsightPanel
              title="✓ What helped"
              color="emerald"
              items={score.top_positive_factors}
              type="positive"
            />
          )}

          {score.top_negative_factors?.length > 0 && (
            <InsightPanel
              title="↓ What held it back"
              color="red"
              items={score.top_negative_factors}
              type="negative"
            />
          )}

          {score.improvement_tips?.length > 0 && (
            /* PRESERVED YELLOW THEME CONTAINER FOR TIPS BANNERS */
            <div className="p-6 bg-gray-900 rounded-2xl border border-gray-800">
              <div className="text-yellow-400 text-sm font-mono mb-4">
                💡 IMPROVEMENT TIPS
              </div>

              <div className="space-y-3">
                {score.improvement_tips.map((t) => (
                  <div key={t.feature} className="p-4 bg-gray-800 rounded-xl">
                    <div className="text-sm font-bold text-white">
                      {t.heading}
                    </div>

                    <div className="text-xs text-gray-400 mt-1">{t.body}</div>

                    <div className="text-xs text-emerald-400 font-mono mt-2">
                      {t.estimated_gain}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusCard({ title, label, value, color, icon, isFeatured = false }) {
  // If it's the featured card (like Credit Score), it gets a solid midnight canvas
  if (isFeatured) {
    return (
      <div className="p-6 rounded-2xl border border-zinc-800 relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col justify-between min-h-40 bg-linear-to-br from-zinc-800 via-zinc-950 to-black shadow-[0_4px_24px_-4px_rgba(9,9,11,0.2)]">
        {/* Subtle Inner Glow Ray Effect */}
        <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-zinc-700/40 to-transparent" />
        <div className="absolute top-0 left-0 w-30 h-30 bg-white/2 rounded-full blur-2xl pointer-events-none -translate-x-10 -translate-y-10" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            {/* Translucent Premium Container for Icon */}
            <div className="text-xl p-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl shadow-inner backdrop-blur-sm text-amber-400">
              {icon}
            </div>
            {/* Sharper, refined badge element matching light-theme scale */}
            <div className="text-[9px] font-mono font-bold tracking-widest uppercase text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 shadow-sm backdrop-blur-sm">
              {label}
            </div>
          </div>

          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-semibold">
            {title}
          </div>
        </div>

        <div className="relative z-10 text-3xl font-extrabold tracking-tight mt-2 text-zinc-50 drop-shadow-sm">
          {value}
        </div>
      </div>
    );
  }

  // ─── STANDARD LIGHT CARDS (PayPal / Utility Bill) ───
  const colorMap = {
    emerald:
      "text-emerald-800 border-emerald-200 bg-emerald-50/60 hover:border-emerald-300",
    yellow:
      "text-amber-800 border-amber-200 bg-amber-50/60 hover:border-amber-300",
    red: "text-red-800 border-red-200 bg-red-50",
    gray: "text-zinc-500 border-zinc-200 bg-zinc-50 hover:border-zinc-300",
    blue: "text-blue-800 border-blue-200 bg-blue-50/60 hover:border-blue-300",
  };

  return (
    <div
      className={`p-6 bg-white rounded-2xl border shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between min-h-40 ${colorMap[color] || colorMap.gray}`}
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-xl p-2 bg-zinc-50 rounded-xl border border-zinc-100 shadow-sm">
            {icon}
          </div>
          <div className="text-[10px] font-mono font-semibold tracking-widest uppercase opacity-80">
            {label}
          </div>
        </div>

        <div className="text-[10px]  font-mono uppercase tracking-wider text-zinc-400 font-semibold">
          {title}
        </div>
      </div>

      <div className="text-2xl font-bold tracking-tight mt-2 text-zinc-950">
        {value}
      </div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200">
      <div className="text-xs text-zinc-400 font-medium tracking-wider mb-1 uppercase">
        {label}
      </div>

      <div className="text-lg font-bold text-zinc-900">{value}</div>
    </div>
  );
}

function InsightPanel({ title, color, items, type }) {
  const titleColor = color === "red" ? "text-red-600" : "text-emerald-600";
  const valueColor = color === "red" ? "text-red-600" : "text-emerald-600";

  return (
    <div className="p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm">
      <div
        className={`${titleColor} text-sm font-semibold tracking-wider uppercase mb-4`}
      >
        {title}
      </div>

      <div className="space-y-3">
        {items.map((f) => (
          <div
            key={f.feature_name}
            className="flex justify-between gap-3 p-4 bg-zinc-50 border border-zinc-150 rounded-xl text-sm"
          >
            <span className="text-zinc-600 font-medium">{f.display_label}</span>

            <span className={`${valueColor} font-bold whitespace-nowrap`}>
              {type === "positive" ? "+" : ""}
              {Number(f.shap_value).toFixed(0)} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
