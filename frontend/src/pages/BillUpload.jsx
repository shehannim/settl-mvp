import { useState, useEffect } from "react";
import axios from "axios";

const API =
  import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

// --- Custom Premium Icons ---
const Icons = {
  UploadCloud: () => (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400 group-hover:text-blue-600 transition-colors"
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

export default function BillUpload({ token }) {
  const [files, setFiles] = useState(() => {
    const saved = localStorage.getItem("bills");
    return saved ? JSON.parse(saved) : [];
  });

  const [ocrResults, setOcrResults] = useState(() =>
    JSON.parse(localStorage.getItem("ocrResults") || "[]")
  );

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedPreview, setSelectedPreview] = useState(0);

  const authToken = token || localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${authToken}` };

  useEffect(() => {
    localStorage.setItem("bills", JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    localStorage.setItem("ocrResults", JSON.stringify(ocrResults));
  }, [ocrResults]);

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
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setOcrResults((prev) => prev.filter((_, i) => i !== index));
    setSelectedPreview(0);
  };

  const uploadAll = async () => {
    setUploading(true);
    setError("");
    setSuccess("");

    const results = [...ocrResults];

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
      } catch (e) {
        results[i] = {
          error: e.response?.data?.detail || e.message || "Upload failed",
        };
      }
    }

    setOcrResults(results);
    setUploading(false);

    const finalResult = results[results.length - 1];

    if (finalResult?.status === "verified") {
      setSuccess(
        "Utility bill verified successfully. Profile verification score updated."
      );
    } else if (finalResult?.status === "needs_staff_review") {
      setSuccess("Utility bill uploaded. This document needs to be checked by staff.");
    } else {
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

  const reviewStatus = selectedData?.status;
  const matchScore = selectedData?.identity_match_score;
  const billName = selectedData?.bill_name;
  const registeredName = selectedData?.registered_name;
  const profileScore = selectedData?.profile_verification_score;

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-slate-50 relative overflow-hidden font-sans text-slate-800 p-4 md:p-8 flex items-start justify-center">
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-200/40 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-[1400px] grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
        <div className="lg:col-span-5 bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[2rem] p-6 md:p-8 shadow-[0_4px_30px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              <span>Underwriting Pipeline</span>
              <span className="text-slate-300">•</span>
              <span className="text-blue-600">Document Ingestion</span>
            </div>

            <h2 className="font-extrabold text-2xl text-slate-900 tracking-tight mb-6">
              Ingest Utility Telemetry
            </h2>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => document.getElementById("fileInput")?.click()}
              className="border-2 border-dashed border-slate-300 bg-slate-50/50 hover:bg-blue-50/30 hover:border-blue-500 transition-all duration-300 p-10 text-center rounded-2xl cursor-pointer group flex flex-col items-center justify-center gap-3"
            >
              <Icons.UploadCloud />
              <div>
                <p className="text-sm font-bold text-slate-700">
                  Drag & drop files here
                </p>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Accepts only utility statement PDFs
                </p>
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

            {files.length > 0 && (
              <div className="mt-6 space-y-2.5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  Queue Stack
                </div>

                {files.map((f, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3.5 bg-white border rounded-xl shadow-sm transition-all ${
                      i === selectedPreview
                        ? "border-blue-500 ring-2 ring-blue-50"
                        : "border-slate-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedPreview(i)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <div
                        className={`p-2 rounded-lg ${
                          ocrResults[i]
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-50 text-slate-400"
                        }`}
                      >
                        <Icons.Document />
                      </div>

                      <span className="text-sm font-semibold text-slate-700 truncate w-48 md:w-64">
                        {f.name}
                      </span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(i);
                      }}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Icons.Trash />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {files.length > 0 && (
            <div className="mt-8 border-t border-slate-100 pt-4">
              <button
                onClick={uploadAll}
                disabled={uploading}
                className="w-full bg-[#0b132b] hover:bg-slate-800 disabled:bg-slate-700 text-white font-bold tracking-wide py-4 rounded-xl transition-all shadow-md flex justify-center items-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Parsing Pipelines...
                  </>
                ) : (
                  "Execute Extraction"
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="text-xs font-medium text-red-600 bg-red-50 px-4 py-2.5 rounded-lg border border-red-100 mt-4">
              {error}
            </div>
          )}

          {success && (
            <div className="text-xs font-medium text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-lg border border-emerald-100 mt-4">
              {success}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[2rem] p-6 md:p-8 shadow-[0_4px_30px_rgba(0,0,0,0.03)] flex flex-col">
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[450px] text-center flex-1">
              <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-300 mb-3">
                <Icons.Document />
              </div>
              <h3 className="font-bold text-slate-400 text-sm uppercase tracking-widest">
                Inspection View Empty
              </h3>
              <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                Upload statements to visually monitor real-time attribute isolation bounds.
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full justify-between flex-1">
              <div>
                <div className="flex gap-1.5 mb-6 flex-wrap border-b border-slate-100 pb-3">
                  {files.map((f, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedPreview(i)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg tracking-wide transition-all ${
                        i === selectedPreview
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                      }`}
                    >
                      {f.name.slice(0, 16)}
                      {f.name.length > 16 ? "..." : ""}
                    </button>
                  ))}
                </div>

                <div className="h-[340px] border border-slate-200 bg-slate-100 rounded-xl overflow-hidden shadow-inner mb-6 relative">
                  {files[selectedPreview]?.preview && (
                    <iframe
                      src={files[selectedPreview].preview}
                      className="w-full h-full border-none"
                      title="Telemetry Frame Monitor"
                    />
                  )}
                </div>

                {selectedData?.error && (
                  <div className="text-xs font-medium text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 mb-4">
                    {selectedData.error}
                  </div>
                )}

                {selectedData && selectedData.status && (
                  <div
                    className={`mb-4 p-4 rounded-xl border ${
                      reviewStatus === "verified"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-amber-50 border-amber-200 text-amber-700"
                    }`}
                  >
                    <div className="text-sm font-bold mb-1">
                      {reviewStatus === "verified"
                        ? "Utility bill verified"
                        : "Needs to be checked by staff"}
                    </div>

                    <div className="text-xs leading-relaxed space-y-1">
                      <div>
                        <span className="font-semibold">Profile name:</span>{" "}
                        {registeredName || "Not available"}
                      </div>
                      <div>
                        <span className="font-semibold">Bill name:</span>{" "}
                        {billName || "Not detected"}
                      </div>
                      <div>
                        <span className="font-semibold">Name match score:</span>{" "}
                        {matchScore !== undefined ? matchScore : "N/A"}
                      </div>
                      <div>
                        <span className="font-semibold">Profile verification score:</span>{" "}
                        {profileScore !== undefined ? profileScore : "N/A"}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                    Extracted Profile Metadata
                  </div>

                  {extractedFields.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {extractedFields.map((f, i) => (
                        <div
                          key={i}
                          className="p-3.5 bg-white border border-slate-100 rounded-xl shadow-sm flex flex-col justify-center"
                        >
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                            {f.field_name?.replace(/_/g, " ")}
                          </div>
                          <div className="text-sm font-bold text-slate-800 truncate">
                            {f.extracted_value || "Not detected"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50/50 border border-slate-200 border-dashed rounded-xl">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                        {uploading
                          ? "Extracting model tensors..."
                          : "Awaiting Pipeline Execution"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}