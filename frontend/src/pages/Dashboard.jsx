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
    if (!band) return "text-gray-400";
    if (band === "excellent") return "text-emerald-400";
    if (band === "good") return "text-emerald-400";
    if (band === "fair") return "text-yellow-400";
    return "text-red-400";
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
            ? value.extracted_value ?? value.value ?? JSON.stringify(value)
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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-emerald-400 text-xs font-mono tracking-widest mb-2">
            SETTL FINANCIAL PROFILE
          </div>

          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            Welcome back
          </h1>

          <p className="text-gray-400 mt-2 max-w-xl">
            Your alternative credit profile is built from verified digital income,
            utility payment behavior, and identity-linked financial signals.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 min-w-[220px]">
          <div className="text-xs text-gray-500 font-mono mb-1">
            PROFILE COMPLETION
          </div>

          <div className="flex items-end justify-between mb-2">
            <div className="text-3xl font-black text-emerald-400">
              {completion}%
            </div>

            <div className="text-xs text-gray-500">
              verified
            </div>
          </div>

          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      </div>

      {/* Top status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          title="PayPal"
          label={paypal ? "Connected" : "Not connected"}
          value={paypal ? "Active" : "Pending"}
          color={paypal ? "emerald" : "yellow"}
          icon="💰"
        />

        <StatusCard
          title="Utility Bill"
          label={ocrResult ? "Uploaded" : "Not uploaded"}
          value={ocrResult ? "Verified" : "Pending"}
          color={ocrResult ? "emerald" : "yellow"}
          icon="🧾"
        />

        <StatusCard
          title="Credit Score"
          label={score ? "Calculated" : "Not calculated"}
          value={score ? score.score : "Pending"}
          color={score ? "emerald" : "gray"}
          icon="⚡"
        />
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* PayPal panel */}
          <div className="p-6 bg-gray-900 rounded-2xl border border-gray-800">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-emerald-400 text-sm font-mono mb-2">
                  STEP 2 · INCOME SOURCE
                </div>

                <h2 className="text-xl font-bold">
                  PayPal Integration
                </h2>

                <p className="text-gray-400 text-sm mt-1">
                  Used to analyse freelance income, transaction history, and earning consistency.
                </p>
              </div>

              <button
                onClick={loadSources}
                className="text-xs px-3 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-emerald-400 transition"
              >
                Refresh
              </button>
            </div>

            {sourcesLoading ? (
              <div className="text-gray-500 text-sm">
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

                <div className="sm:col-span-3 mt-2 p-4 rounded-xl bg-emerald-400/5 border border-emerald-400/20">
                  <div className="text-emerald-400 text-sm font-mono">
                    ✅ PayPal already connected
                  </div>

                  <div className="text-gray-400 text-xs mt-1">
                    This income source will be included when calculating your score.
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-yellow-400/5 border border-yellow-400/20">
                <div className="text-yellow-400 font-mono text-sm mb-2">
                  ⚠️ PayPal not connected
                </div>

                <p className="text-gray-400 text-sm mb-4">
                  Connect PayPal to improve your score confidence and income stability analysis.
                </p>

                <button
                  onClick={() => go && go("paypal-connect")}
                  className="px-4 py-3 rounded-xl bg-emerald-400 text-gray-950 font-bold hover:bg-emerald-300 transition"
                >
                  Connect PayPal →
                </button>
              </div>
            )}
          </div>

          {/* Upload bill */}
          <div className="p-6 bg-gray-900 rounded-2xl border border-gray-800">
            <div className="text-emerald-400 text-sm font-mono mb-2">
              STEP 3 · UTILITY BILL
            </div>

            <h2 className="text-xl font-bold mb-2">
              Upload a utility bill
            </h2>

            <p className="text-gray-400 text-sm mb-5">
              Upload a CEB, Dialog, Water Board, or similar bill. Settl extracts payment behavior using OCR.
            </p>

            <div
              onClick={() => document.getElementById("billInput").click()}
              className="border-2 border-dashed border-gray-700 rounded-2xl p-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-400/5 transition"
            >
              {file ? (
                <div>
                  <div className="text-4xl mb-3">📄</div>

                  <div className="text-emerald-400 font-mono text-sm">
                    {file.name} ✓
                  </div>

                  <div className="text-gray-500 text-xs mt-1">
                    Ready to extract bill data
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-4xl mb-3">⬆️</div>

                  <div className="text-gray-400">
                    Click to select a PDF bill
                  </div>

                  <div className="text-gray-600 text-xs mt-1">
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
              className="w-full mt-4 p-4 bg-emerald-400 text-gray-950 font-bold rounded-xl hover:bg-emerald-300 transition disabled:opacity-50"
            >
              {uploading ? "Extracting bill data..." : "Extract bill data →"}
            </button>
          </div>

          {/* OCR result viewer */}
          {ocrResult && (
            <div className="p-6 bg-gray-900 rounded-2xl border border-gray-800">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
                <div>
                  <div className="text-emerald-400 text-sm font-mono mb-1">
                    OCR RESULT
                  </div>

                  <h2 className="text-2xl font-bold">
                    {ocrResult.biller_detected ||
                      ocrResult.biller ||
                      ocrResult.provider ||
                      "Unknown biller"}
                  </h2>

                  <p className="text-gray-400 text-sm mt-1">
                    Review the extracted fields and raw OCR text below.
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-xs text-gray-500 font-mono">
                    CONFIDENCE
                  </div>

                  <div className="text-emerald-400 text-2xl font-black">
                    {ocrResult.overall_confidence !== undefined &&
                    ocrResult.overall_confidence !== null
                      ? `${(Number(ocrResult.overall_confidence) * 100).toFixed(0)}%`
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Extracted fields */}
              <div className="mb-6">
                <div className="text-xs text-gray-500 font-mono mb-3">
                  EXTRACTED FIELDS
                </div>

                {extractedFields.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {extractedFields.map((f, index) => (
                      <div
                        key={`${f.field_name}-${index}`}
                        className="p-4 bg-gray-800 rounded-xl border border-gray-700"
                      >
                        <div className="text-gray-500 text-xs font-mono mb-1">
                          {(f.field_name || "unknown field")
                            .replace(/_/g, " ")
                            .toUpperCase()}
                        </div>

                        <div className="text-white text-sm font-mono break-words">
                          {f.extracted_value !== undefined &&
                          f.extracted_value !== null &&
                          String(f.extracted_value).trim() !== ""
                            ? String(f.extracted_value)
                            : "Not detected"}
                        </div>

                        {f.confidence !== undefined && f.confidence !== null && (
                          <div className="text-xs text-emerald-400 mt-2 font-mono">
                            Confidence: {(Number(f.confidence) * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-400/5 border border-yellow-400/20 rounded-xl text-yellow-400 text-sm">
                    No structured fields were detected. Check the raw OCR text below.
                  </div>
                )}
              </div>

              {/* Raw OCR text */}
              <div>
                <div className="text-xs text-gray-500 font-mono mb-3">
                  RAW OCR TEXT
                </div>

                <div className="max-h-72 overflow-y-auto p-4 bg-black/40 border border-gray-800 rounded-xl">
                  <pre className="text-gray-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">
                    {rawOcrText || "No raw OCR text returned from backend."}
                  </pre>
                </div>
              </div>

              {/* Full debug JSON */}
              <details className="mt-5">
                <summary className="cursor-pointer text-xs text-gray-500 font-mono hover:text-emerald-400">
                  SHOW FULL OCR JSON DEBUG
                </summary>

                <pre className="mt-3 max-h-72 overflow-y-auto p-4 bg-black/40 border border-gray-800 rounded-xl text-gray-300 text-xs whitespace-pre-wrap">
                  {JSON.stringify(ocrResult, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Score action */}
          <div className="p-6 bg-gray-900 rounded-2xl border border-gray-800 sticky top-6">
            <div className="text-emerald-400 text-sm font-mono mb-2">
              STEP 4 · SCORE
            </div>

            <h2 className="text-xl font-bold mb-2">
              Calculate your score
            </h2>

            <p className="text-gray-400 text-sm mb-5">
              Your score will combine connected sources, bill history, and identity consistency.
            </p>

            {error && (
              <div className="mb-4 text-red-400 text-sm font-mono p-3 rounded-xl bg-red-400/5 border border-red-400/20">
                {error}
              </div>
            )}

            <button
              onClick={computeScore}
              disabled={loading}
              className="w-full p-4 bg-emerald-400 text-gray-950 font-bold rounded-xl hover:bg-emerald-300 transition disabled:opacity-50"
            >
              {loading ? "Calculating..." : "Calculate my score →"}
            </button>
          </div>

          {/* Score result */}
          {score && (
            <div className="p-6 bg-gray-900 rounded-2xl border border-emerald-400/20 shadow-[0_0_40px_rgba(52,211,153,0.06)]">
              <div className="text-center mb-6">
                <div className="text-sm text-gray-400 font-mono mb-2">
                  YOUR CREDIT SCORE
                </div>

                <div className="text-7xl font-black text-emerald-400">
                  {score.score}
                </div>

                <div className={`text-xl font-bold mt-2 capitalize ${bandColor(score.band)}`}>
                  {score.band}
                </div>

                <div className="text-gray-500 text-xs mt-2 font-mono">
                  300 ──── {score.score} ──── 850
                </div>
              </div>

              <div className="p-4 bg-gray-800 rounded-xl mb-5">
                <div className="text-sm text-gray-400 font-mono">
                  Confidence
                </div>

                <div className="text-2xl font-bold text-emerald-400">
                  {(score.confidence * 100).toFixed(0)}%
                </div>

                <div className="h-2 bg-gray-700 rounded-full overflow-hidden mt-3">
                  <div
                    className="h-full bg-emerald-400 rounded-full"
                    style={{ width: `${score.confidence * 100}%` }}
                  />
                </div>
              </div>

              {categories.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs text-gray-500 font-mono mb-2">
                    SCORE BREAKDOWN
                  </div>

                  {categories.map((c) => (
                    <div key={c.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400 capitalize">
                          {c.category.replace(/_/g, " ")}
                        </span>

                        <span className="text-emerald-400 font-mono">
                          {Number(c.score).toFixed(0)}%
                        </span>
                      </div>

                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full"
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
            <div className="p-6 bg-gray-900 rounded-2xl border border-gray-800">
              <div className="text-yellow-400 text-sm font-mono mb-4">
                💡 IMPROVEMENT TIPS
              </div>

              <div className="space-y-3">
                {score.improvement_tips.map((t) => (
                  <div
                    key={t.feature}
                    className="p-4 bg-gray-800 rounded-xl"
                  >
                    <div className="text-sm font-bold text-white">
                      {t.heading}
                    </div>

                    <div className="text-xs text-gray-400 mt-1">
                      {t.body}
                    </div>

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

function StatusCard({ title, label, value, color, icon }) {
  const colorMap = {
    emerald: "text-emerald-400 border-emerald-400/20 bg-emerald-400/5",
    yellow: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
    red: "text-red-400 border-red-400/20 bg-red-400/5",
    gray: "text-gray-400 border-gray-800 bg-gray-900",
  };

  return (
    <div className={`p-5 rounded-2xl border ${colorMap[color] || colorMap.gray}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-2xl">{icon}</div>
        <div className="text-xs font-mono uppercase">{label}</div>
      </div>

      <div className="text-gray-400 text-sm">
        {title}
      </div>

      <div className="text-xl font-black text-white mt-1">
        {value}
      </div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="p-4 bg-gray-800 rounded-xl border border-gray-700">
      <div className="text-xs text-gray-500 font-mono mb-1">
        {label.toUpperCase()}
      </div>

      <div className="text-lg font-bold text-white">
        {value}
      </div>
    </div>
  );
}

function InsightPanel({ title, color, items, type }) {
  const titleColor = color === "red" ? "text-red-400" : "text-emerald-400";
  const valueColor = color === "red" ? "text-red-400" : "text-emerald-400";

  return (
    <div className="p-6 bg-gray-900 rounded-2xl border border-gray-800">
      <div className={`${titleColor} text-sm font-mono mb-4`}>
        {title}
      </div>

      <div className="space-y-3">
        {items.map((f) => (
          <div
            key={f.feature_name}
            className="flex justify-between gap-3 p-4 bg-gray-800 rounded-xl text-sm"
          >
            <span className="text-gray-300">
              {f.display_label}
            </span>

            <span className={`${valueColor} font-mono whitespace-nowrap`}>
              {type === "positive" ? "+" : ""}
              {Number(f.shap_value).toFixed(0)} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
