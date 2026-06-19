import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API =
  import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

/* =========================
   Icons
========================= */
const Icons = {
  PayPal: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 7h8.5a3.5 3.5 0 0 1 0 7H11v7l-2-1V7Z" />
    </svg>
  ),

  Stripe: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4.5a3.5 3.5 0 0 0-3.5 3.5c0 2.5 4 3 4 5a2 2 0 0 1-2 2 2.5 2.5 0 0 1-2.5-2" />
      <path d="M12 2v20" />
    </svg>
  ),

  Bank: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 21h18" />
      <path d="M3 10h18" />
      <path d="m5 6 7-3 7 3" />
      <path d="M4 10v11" />
      <path d="M20 10v11" />
      <path d="M8 14v3" />
      <path d="M12 14v3" />
      <path d="M16 14v3" />
    </svg>
  ),

  Trending: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),

  Refresh: () => (
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
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  ),

  Plus: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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

  Star: ({ filled }) => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
};

export default function PayPalDashboard({ go }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);

  const [syncingId, setSyncingId] = useState(null);
  const [disconnectingId, setDisconnectingId] = useState(null);
  const [confirmDisconnectId, setConfirmDisconnectId] = useState(null);

  const authToken = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${authToken}` };

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    setLoading(true);

    try {
      const res = await axios.get(`${API}/api/connect/sources`, { headers });
      const realSources = res.data?.sources || [];

      const mappedReal = realSources.map((s) => ({
        id: s.source,
        type: s.source,
        name: s.source === "paypal" ? "PayPal Merchant" : s.source,
        account: s.account_name || "Connected Account",
        transactions: s.transaction_count || 0,
        lastSync: "Just now",
        isPrimary: s.is_primary || false,
        isDemo: false,
      }));

      setSources(mappedReal);
    } catch (err) {
      console.error("Failed to load sources", err);
    }

    setLoading(false);
  };

  const handleSync = async (source) => {
    setSyncingId(source.id);

    try {
      await axios.post(`${API}/api/score/compute`, {}, { headers });
      await loadSources();
    } catch (err) {
      console.error("Sync failed", err);
    }

    setSyncingId(null);
  };

  const handleSetPrimary = async (source) => {
    try {
      await axios.patch(`${API}/api/connect/${source.id}/primary`, {}, { headers });
    } catch (err) {
      console.error("Primary set failed", err);
    }

    setSources(sources.map((s) => ({ ...s, isPrimary: s.id === source.id })));
  };

  const executeDisconnect = async (source) => {
    setDisconnectingId(source.id);

    try {
      await axios.delete(`${API}/api/connect/${source.id}`, { headers });
    } catch (err) {
      console.error("Disconnect failed", err);
    }

    setSources(sources.filter((s) => s.id !== source.id));
    setConfirmDisconnectId(null);
    setDisconnectingId(null);
  };

  const sortedSources = useMemo(
    () =>
      [...sources].sort((a, b) =>
        a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1
      ),
    [sources]
  );

  const totalTransactions = useMemo(
    () => sources.reduce((acc, curr) => acc + curr.transactions, 0),
    [sources]
  );

  const hasRealPaypal = useMemo(
    () => sources.some((s) => s.type === "paypal"),
    [sources]
  );

  const incomeLabel = hasRealPaypal ? "Reconnect PayPal" : "Connect PayPal";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] w-full">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          Loading secure telemetry...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-slate-50 relative overflow-hidden font-sans text-slate-800 p-4 md:p-8 flex items-start justify-center">
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-200/40 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-[1400px] grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">

        {/* LEFT COLUMN */}
        <div className="lg:col-span-4 space-y-6">

          {/* Income Pipelines */}
          <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[2rem] p-6 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="font-bold text-slate-900">Income Pipelines</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Link verified income streams to improve your financial profile.
                </p>
              </div>

              <button
                onClick={() => go && go("paypal-connect")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-xs font-bold uppercase tracking-wider hover:bg-slate-900 transition shadow-sm"
              >
                <Icons.Plus />
                {incomeLabel}
              </button>
            </div>

            {/* PayPal connect card */}
            <div className="mb-5 rounded-2xl bg-slate-950 text-white p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50 mb-2">
                    PayPal Income
                  </div>
                  <div className="text-lg font-semibold">
                    {hasRealPaypal ? "PayPal account active" : "PayPal not connected"}
                  </div>
                  <div className="text-sm text-white/60 mt-1">
                    {hasRealPaypal
                      ? "Your PayPal source is ready for income-linked analysis."
                      : "Connect PayPal to pull real merchant income data."}
                  </div>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-[#003087] text-white flex items-center justify-center shrink-0">
                  <Icons.PayPal />
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={() => go && go("paypal-connect")}
                  className="px-4 py-2 rounded-full bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100 transition"
                >
                  {incomeLabel}
                </button>
              </div>
            </div>

            {/* Sources */}
            <div className="space-y-4">
              {sources.length === 0 && (
                <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                    No Pipelines Linked
                  </p>
                </div>
              )}

              {sortedSources.map((s) => (
                <div
                  key={s.id}
                  className={`flex flex-col bg-white border rounded-2xl transition-all duration-200 shadow-sm relative overflow-hidden ${
                    s.isPrimary
                      ? "border-emerald-400 ring-2 ring-emerald-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="p-4 border-b border-slate-100 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-inner ${
                          s.type === "paypal"
                            ? "bg-[#003087]"
                            : s.type === "stripe"
                            ? "bg-[#635BFF]"
                            : "bg-slate-800"
                        }`}
                      >
                        {s.type === "paypal" ? (
                          <Icons.PayPal />
                        ) : s.type === "stripe" ? (
                          <Icons.Stripe />
                        ) : (
                          <Icons.Bank />
                        )}
                      </div>

                      <div>
                        <div className="text-sm font-bold text-slate-900 capitalize">
                          {s.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate w-32">
                          {s.account}
                        </div>
                      </div>
                    </div>

                    {s.isPrimary && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 text-[9px] font-bold uppercase tracking-widest rounded-md border border-emerald-100">
                        <Icons.Star filled />
                        Primary
                      </div>
                    )}
                  </div>

                  {confirmDisconnectId === s.id ? (
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-red-50 border-t border-red-100 flex flex-col gap-2 z-10">
                      <span className="text-xs font-bold text-red-800 text-center">
                        Disconnect source?
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDisconnectId(null)}
                          className="flex-1 py-1.5 bg-white border border-red-200 text-slate-600 text-[10px] font-bold uppercase tracking-widest rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => executeDisconnect(s)}
                          disabled={disconnectingId === s.id}
                          className="flex-1 py-1.5 bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg flex justify-center items-center"
                        >
                          {disconnectingId === s.id ? "..." : "Remove"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 flex justify-between items-center">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleSync(s)}
                          disabled={syncingId === s.id}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors disabled:opacity-50"
                        >
                          <div className={syncingId === s.id ? "animate-spin text-blue-600" : ""}>
                            <Icons.Refresh />
                          </div>
                          Sync
                        </button>

                        {!s.isPrimary && (
                          <button
                            onClick={() => handleSetPrimary(s)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 text-slate-600 text-[9px] font-bold uppercase tracking-widest rounded-md transition-colors"
                          >
                            <Icons.Star />
                            Make Primary
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => setConfirmDisconnectId(s.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Icons.Trash />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0b132b] p-6 rounded-[2rem] text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Total Verified Tx
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  {totalTransactions}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                Avg Ticket
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900">
                --
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-8 space-y-6">

          {/* No hardcoded chart */}
          <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[2.5rem] p-8 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between mb-8 gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  Verified Income Trends
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Live trend data will appear here when transaction history is available.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-slate-200">
                <Icons.Trending />
                No Live Data
              </div>
            </div>

            <div className="w-full min-h-[220px] flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60">
              <div className="text-center">
                <div className="text-sm font-semibold text-slate-700">
                  No real income trend data available yet
                </div>
                <div className="text-xs text-slate-400 mt-2 max-w-md">
                  Connect live payment sources and expose monthly income history from the backend to render this chart.
                </div>
              </div>
            </div>
          </div>

          {/* No hardcoded ledger */}
          <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[2.5rem] p-8 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
            <h3 className="font-bold text-slate-900 mb-6 text-lg tracking-tight">
              Recent Handshakes
            </h3>

            <div className="min-h-[180px] flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60">
              <div className="text-center">
                <div className="text-sm font-semibold text-slate-700">
                  No live transaction ledger available yet
                </div>
                <div className="text-xs text-slate-400 mt-2 max-w-md">
                  Replace this section with real transaction records once your backend exposes a transactions endpoint.
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}