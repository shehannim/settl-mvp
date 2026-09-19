import { useState, useEffect } from "react";
import axios from "axios";
import cebLogo from "../assets/ceylon-electricity-board-logo-png_seeklogo-226257.png";
import sltLogo from "../assets/SLT.png";
import dialogLogo from "../assets/png-clipart-dialog-axiata-axiata-group-xl-axiata-colombo-dialog-broadband-networks-dialog-axiata-angle-rectangle.png";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

// --- Design System Icons ---
const Icons = {
  UploadCloud: () => (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400 group-hover:text-[#004fc5] transition-colors"
    >
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M12 12v9" />
      <path d="m16 16-4-4-4 4" />
    </svg>
  ),

  Document: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  ),

  Trash: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),

  Check: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

const DEFAULT_BILL_RECORDS = [
  {
    id: "rec-ceb-01",
    provider: "CEB Electricity",
    biller: "Ceylon Electricity Board",
    accountNumber: "042-8921-992",
    accountHolder: "Damidu Herath",
    billingPeriod: "Aug 2026",
    uploadDate: "2026-08-15",
    amount: "LKR 7,850.00",
    status: "verified",
    paymentSignal: "Paid on time",
    scoreImpact: "+20 pts",
    logo: cebLogo,
  },
  {
    id: "rec-slt-02",
    provider: "SLT Fibre Broadband",
    biller: "Sri Lanka Telecom",
    accountNumber: "011-238-4410",
    accountHolder: "Damidu Herath",
    billingPeriod: "Jul 2026",
    uploadDate: "2026-07-28",
    amount: "LKR 4,200.00",
    status: "verified",
    paymentSignal: "Paid on time",
    scoreImpact: "+15 pts",
    logo: sltLogo,
  },
  {
    id: "rec-dialog-03",
    provider: "Dialog Postpaid",
    biller: "Dialog Axiata",
    accountNumber: "077-412-8901",
    accountHolder: "Damidu Herath",
    billingPeriod: "Aug 2026",
    uploadDate: "2026-08-20",
    amount: "LKR 3,150.00",
    status: "verified",
    paymentSignal: "Paid on time",
    scoreImpact: "+12 pts",
    logo: dialogLogo,
  },
];

export default function BillUpload({ token, go }) {
  // File objects + blob URLs live in memory only — they cannot survive
  // JSON serialization, so the queue always starts fresh per session.
  // Parsed results and the bill log persist separately below.
  const [files, setFiles] = useState([]);

  const [ocrResults, setOcrResults] = useState([]);

  const [billRecords, setBillRecords] = useState(() => {
    const saved = localStorage.getItem("settl_bill_records");
    return saved ? JSON.parse(saved) : DEFAULT_BILL_RECORDS;
  });

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedPreview, setSelectedPreview] = useState(0);

  const authToken = token || localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${authToken}` };

  useEffect(() => {
    localStorage.setItem("settl_bill_records", JSON.stringify(billRecords));
  }, [billRecords]);

  const addFiles = (incoming) => {
    const valid = incoming.filter((f) => f.type === "application/pdf");

    if (valid.length > 0) {
      const mapped = valid.map((file) => ({
        name: file.name,
        type: file.type,
        preview: URL.createObjectURL(file),
        file,
      }));

      setFiles((prev) => [...prev, ...mapped]);
      setOcrResults((prev) => [...prev, ...valid.map(() => null)]);
      setError("");
      setSuccess("");
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files || []));
  };

  const onInputChange = (e) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = "";
  };

  const removeFile = (index) => {
    setFiles((prev) => {
      const target = prev[index];
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== index);
    });
    setOcrResults((prev) => prev.filter((_, i) => i !== index));
    setSelectedPreview(0);
  };

  const getBillerLogo = (billerName) => {
    const lower = (billerName || "").toLowerCase();
    if (lower.includes("ceb") || lower.includes("electricity")) return cebLogo;
    if (lower.includes("slt") || lower.includes("telecom") || lower.includes("fibre")) return sltLogo;
    return dialogLogo;
  };

  const uploadAll = async () => {
    setUploading(true);
    setError("");
    setSuccess("");

    const results = [...ocrResults];
    const newRecords = [];

    for (let i = 0; i < files.length; i++) {
      try {
        if (!files[i].file) continue;

        const form = new FormData();
        form.append("file", files[i].file);

        const res = await axios.post(`${API}/api/ingest/utility-bill`, form, {
          headers: {
            ...headers,
            "Content-Type": "multipart/form-data",
          },
        });

        results[i] = res.data;

        if (res.data?.profile_verification_score !== undefined) {
          localStorage.setItem(
            "profile_verification_score",
            String(res.data.profile_verification_score)
          );
          localStorage.setItem("profile_score_refresh", "1");
        }

        if (res.data?.status) {
          localStorage.setItem("utility_bill_review_status", res.data.status);
        }

        if (res.data?.identity_match_score !== undefined) {
          localStorage.setItem(
            "utility_bill_name_match_score",
            String(res.data.identity_match_score)
          );
        }

        // Add to persistent bill records
        const billerName = res.data?.biller_detected || "Utility Statement";
        const newRecord = {
          id: `bill-${Date.now()}-${i}`,
          provider: billerName,
          biller: billerName,
          accountNumber:
            res.data?.fields?.find((f) =>
              f.field_name?.toLowerCase().includes("account")
            )?.extracted_value || files[i].name,
          accountHolder: res.data?.bill_name || res.data?.registered_name || "Verified Holder",
          billingPeriod: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          uploadDate: new Date().toISOString().split("T")[0],
          amount:
            res.data?.fields?.find((f) =>
              f.field_name?.toLowerCase().includes("amount") ||
              f.field_name?.toLowerCase().includes("total")
            )?.extracted_value || "Verified",
          status: res.data?.status === "verified" ? "verified" : "needs_staff_review",
          paymentSignal: res.data?.payment_on_time ? "Paid on time" : "Verified repayment",
          scoreImpact: res.data?.status === "verified" ? "+25 pts" : "+10 pts",
          logo: getBillerLogo(billerName),
        };
        newRecords.push(newRecord);
      } catch (e) {
        results[i] = {
          error: e.response?.data?.detail || e.message || "Upload failed",
        };
      }
    }

    if (newRecords.length > 0) {
      setBillRecords((prev) => [...newRecords, ...prev]);
    }

    setOcrResults(results);
    setUploading(false);

    const finalResult = results[results.length - 1];

    if (finalResult?.status === "verified") {
      setSuccess("Utility statement verified successfully. Payment reliability calibrated.");
    } else if (finalResult?.status === "needs_staff_review") {
      setSuccess("Utility statement uploaded and queued for institutional review.");
    } else if (results.some((r) => !r?.error)) {
      setSuccess("Bill uploaded successfully.");
    }
  };

  const normalizeOcrFields = (fields) => {
    if (!fields) return [];

    if (Array.isArray(fields)) {
      return fields.map((f, i) => ({
        field_name: f.field_name || f.name || f.key || `field_${i + 1}`,
        extracted_value: f.extracted_value ?? f.value ?? f.text ?? "",
        confidence: f.confidence,
      }));
    }

    if (typeof fields === "object") {
      return Object.entries(fields).map(([key, value]) => ({
        field_name: key,
        extracted_value:
          typeof value === "object" && value !== null
            ? value.extracted_value ?? value.value
            : value,
        confidence:
          typeof value === "object" && value !== null
            ? value.confidence
            : undefined,
      }));
    }

    return [];
  };

  const selectedData = ocrResults[selectedPreview] || {};
  const extractedFields = normalizeOcrFields(selectedData?.fields || []);
  const docMeta = selectedData?.metadata || {};

  const reviewStatus = selectedData?.status;
  const matchScore = selectedData?.identity_match_score;
  const billName = selectedData?.bill_name;
  const registeredName = selectedData?.registered_name;
  const profileScore = selectedData?.profile_verification_score;

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#f8f9ff] px-4 py-6 text-slate-900 sm:px-6 lg:px-8 font-sans">
      <main className="mx-auto max-w-[1180px] space-y-6">
        {/* Header matching Settl design system */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-slate-900">
                Utility Statements & Bills
              </h1>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#004fc5]">
                Alternative Credit Signals
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Upload Ceylon Electricity Board, SLT Fibre, or Dialog statements to calibrate payment regularity and boost your Settl score.
            </p>
          </div>

          {go && (
            <button
              onClick={() => go("dashboard")}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              ← Back to Dashboard
            </button>
          )}
        </header>

        {/* Upload & Inspection Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Upload Card (Left Column) */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h2 className="text-base font-bold text-slate-900">Upload Statement</h2>
                <span className="text-xs text-slate-400">PDF up to 10MB</span>
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => document.getElementById("fileInput")?.click()}
                className="border-2 border-dashed border-slate-200 bg-slate-50/70 hover:bg-blue-50/40 hover:border-[#004fc5]/60 transition-all duration-200 p-8 text-center rounded-2xl cursor-pointer group flex flex-col items-center justify-center gap-3"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-xs group-hover:scale-105 transition">
                  <Icons.UploadCloud />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Drop statements here, or <span className="text-[#004fc5]">browse</span>
                  </p>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    Accepts official CEB, LECO, SLT, or Dialog PDF statements
                  </p>
                </div>

                {/* Supported utility tags */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                  {["CEB Electricity", "SLT Fibre", "Dialog Postpaid"].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <input
                id="fileInput"
                type="file"
                multiple
                accept=".pdf"
                className="hidden"
                onChange={onInputChange}
              />

              {/* Upload Queue */}
              {files.length > 0 && (
                <div className="mt-5 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Queued for Verification ({files.length})
                  </div>

                  {files.map((f, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        i === selectedPreview
                          ? "border-[#004fc5] bg-blue-50/40 ring-1 ring-[#004fc5]"
                          : "border-slate-100 bg-slate-50/60 hover:bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedPreview(i)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            ocrResults[i]
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-blue-50 text-[#004fc5]"
                          }`}
                        >
                          <Icons.Document />
                        </div>
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {f.name}
                        </span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(i);
                        }}
                        aria-label="Remove statement"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Icons.Trash />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Execute Button */}
            {files.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={uploadAll}
                  disabled={uploading}
                  className="w-full rounded-full bg-[#004fc5] hover:bg-[#003a94] disabled:bg-blue-300 text-white font-bold text-sm py-3 px-5 transition-all shadow-md shadow-blue-500/15 flex justify-center items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Verifying Statement Data…
                    </>
                  ) : (
                    "Process & Verify Statements"
                  )}
                </button>
              </div>
            )}

            {error && (
              <div className="text-xs font-semibold text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 mt-4">
                {error}
              </div>
            )}

            {success && (
              <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-100 mt-4 flex items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">✓</span>
                {success}
              </div>
            )}
          </div>

          {/* Statement Inspection / OCR View (Right Column) */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)] flex flex-col">
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center flex-1 p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-400 mb-4">
                  <Icons.Document />
                </div>
                <h3 className="font-bold text-slate-800 text-base">
                  No Active Statement Selected
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
                  Upload a utility statement to inspect detected OCR attributes, name matching calibration, and on-time repayment status.
                </p>
              </div>
            ) : (
              <div className="flex flex-col h-full justify-between flex-1">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <h2 className="text-base font-bold text-slate-900">Statement Preview & OCR Calibration</h2>
                    <span className="font-mono text-xs text-slate-500">
                      File {selectedPreview + 1} of {files.length}
                    </span>
                  </div>

                  {/* Document iframe frame */}
                  <div className="h-[220px] sm:h-[280px] border border-slate-200 bg-slate-50 rounded-xl overflow-hidden shadow-inner mb-5 relative">
                    {files[selectedPreview]?.preview && (
                      <iframe
                        src={files[selectedPreview].preview}
                        className="w-full h-full border-none"
                        title="Statement Viewer"
                      />
                    )}
                  </div>

                  {selectedData?.error && (
                    <div className="text-xs font-medium text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 mb-4">
                      {selectedData.error}
                    </div>
                  )}

                  {/* Verification Status Banner */}
                  {selectedData && selectedData.status && (
                    <div
                      className={`mb-5 p-4 rounded-xl border ${
                        reviewStatus === "verified"
                          ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                          : "bg-amber-50/70 border-amber-200 text-amber-900"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold flex items-center gap-1.5">
                          {reviewStatus === "verified" ? "✓ Statement Verified" : "⚠️ Needs Staff Review"}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold shadow-xs">
                          Match: {matchScore !== undefined ? `${Math.round(matchScore * 100)}%` : "N/A"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Registered:</span>
                          <span className="font-bold truncate block">{registeredName || "Not available"}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Bill Name:</span>
                          <span className="font-bold truncate block">{billName || "Not detected"}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Match Score:</span>
                          <span className="font-mono font-bold block">{matchScore !== undefined ? matchScore : "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Verification Bonus:</span>
                          <span className="font-mono font-bold block">{profileScore ? `+${profileScore} pts` : "Applied"}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Extracted Profile Metadata */}
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                      Extracted Fields & Verification Telemetry
                    </div>

                    {extractedFields.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {extractedFields.map((f, i) => (
                          <div
                            key={i}
                            className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl flex flex-col justify-center"
                          >
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                              {f.field_name?.replace(/_/g, " ")}
                            </div>
                            <div className="font-mono text-xs font-bold text-slate-800 truncate">
                              {f.extracted_value || "Not detected"}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center bg-slate-50/50 border border-slate-200 border-dashed rounded-xl">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                          {uploading ? "Extracting document data…" : "Pending Verification Execution"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Document Metadata */}
                  {docMeta && Object.keys(docMeta).length > 0 && (
                    <div className="mt-4">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                        Document Metadata
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {[
                          ["File", docMeta.filename],
                          [
                            "Size",
                            docMeta.file_size_bytes !== undefined
                              ? `${(docMeta.file_size_bytes / 1024).toFixed(1)} KB`
                              : undefined,
                          ],
                          ["Pages", docMeta.page_count ?? "Unknown"],
                          [
                            "Extraction",
                            docMeta.extraction?.stage
                              ? `${docMeta.extraction.stage}${
                                  docMeta.extraction?.chars
                                    ? ` · ${docMeta.extraction.chars} chars`
                                    : ""
                                }`
                              : undefined,
                          ],
                          ["Producer", docMeta.pdf_info?.producer],
                          ["Creator", docMeta.pdf_info?.creator],
                          ["Created", docMeta.pdf_info?.creationDate],
                          ["Modified", docMeta.pdf_info?.modDate],
                        ]
                          .filter(([, v]) => v !== undefined && v !== null && v !== "")
                          .map(([label, value], i) => (
                            <div
                              key={i}
                              className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl flex flex-col justify-center"
                            >
                              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                                {label}
                              </div>
                              <div className="font-mono text-xs font-bold text-slate-800 truncate">
                                {String(value)}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Previously Added Bills Section */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Statement Ingestion Records</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Historical statements analyzed and calibrated into your alternative credit score model
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#004fc5]">
              {billRecords.length} statements logged
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pl-2">Utility Provider</th>
                  <th className="pb-3">Account & Holder</th>
                  <th className="pb-3">Billing Period</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Signal & Impact</th>
                  <th className="pb-3 pr-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {billRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 pl-2">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white p-1">
                          <img
                            src={record.logo || cebLogo}
                            alt={record.provider}
                            className="h-full w-full object-contain"
                          />
                        </span>
                        <div>
                          <span className="font-bold text-slate-800 block text-sm">{record.provider}</span>
                          <span className="text-[10px] text-slate-400">{record.biller}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5">
                      <div className="font-mono text-xs font-semibold text-slate-800">{record.accountNumber}</div>
                      <div className="text-[11px] text-slate-500">{record.accountHolder}</div>
                    </td>

                    <td className="py-3.5">
                      <span className="font-mono text-xs font-medium text-slate-700">{record.billingPeriod}</span>
                      <span className="block text-[10px] text-slate-400 font-mono">Uploaded: {record.uploadDate}</span>
                    </td>

                    <td className="py-3.5 font-mono text-xs font-bold text-slate-800">
                      {record.amount}
                    </td>

                    <td className="py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                          {record.paymentSignal}
                        </span>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#004fc5]">
                          {record.scoreImpact}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 pr-2 text-right">
                      {record.status === "verified" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <Icons.Check /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                          Needs Review
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}