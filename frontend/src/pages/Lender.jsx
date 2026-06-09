import { useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

export default function Lender() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [settl_id, setSettlId] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const login = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API}/api/auth/lender/login`, { email, password });
      setToken(res.data.access_token);
      setLoggedIn(true);
    } catch (e) {
      setError("Invalid lender credentials");
    }
    setLoading(false);
  };

  const query = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API}/api/lender/query/${settl_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Query failed");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-10 px-4 space-y-6">
      <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
        <div className="text-blue-400 text-sm font-mono">LENDER PORTAL · First Capital NBFI</div>
      </div>

      {!loggedIn ? (
        <div className="p-6 bg-gray-900 rounded-2xl border border-gray-800">
          <h2 className="text-xl font-bold mb-4">Lender login</h2>
          <div className="space-y-4">
            <input
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-blue-400"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <input
              type="password"
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-blue-400"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="mt-3 text-red-400 text-sm font-mono">{error}</div>}
          <button
            onClick={login}
            disabled={loading}
            className="w-full mt-4 p-4 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-400 transition disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login →"}
          </button>
        </div>
      ) : (
        <div className="p-6 bg-gray-900 rounded-2xl border border-gray-800">
          <h2 className="text-xl font-bold mb-4">Query applicant score</h2>
          <label className="text-xs text-gray-400 font-mono uppercase">Settl ID</label>
          <input
            className="w-full mt-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-blue-400 font-mono"
            placeholder="STL-2025-XXXXXX"
            value={settl_id}
            onChange={e => setSettlId(e.target.value)}
          />
          {error && <div className="mt-3 text-red-400 text-sm font-mono">{error}</div>}
          <button
            onClick={query}
            disabled={loading || !settl_id}
            className="w-full mt-4 p-4 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-400 transition disabled:opacity-50"
          >
            {loading ? "Fetching..." : "Retrieve score →"}
          </button>
        </div>
      )}

      {result && (
        <div className="p-6 bg-gray-900 rounded-2xl border border-gray-800">
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="font-bold">{result.applicant_name}</div>
              <div className="text-xs text-gray-400 font-mono">{result.settl_id}</div>
            </div>
            <div className="px-3 py-1 bg-emerald-400/10 border border-emerald-400/30 rounded-full text-emerald-400 text-xs font-mono">
              ✓ Meets criteria
            </div>
          </div>
          <div className="text-center p-4 bg-gray-800 rounded-xl mb-4">
            <div className="text-6xl font-black text-emerald-400">{result.score}</div>
            <div className="text-gray-400 text-sm mt-1 capitalize">{result.band}</div>
          </div>
          <div className="flex gap-3 mb-4">
            <div className="flex-1 p-3 bg-gray-800 rounded-xl text-center">
              <div className="text-2xl font-bold text-emerald-400">{(result.confidence * 100).toFixed(0)}%</div>
              <div className="text-xs text-gray-400 font-mono">Confidence</div>
            </div>
            <div className="flex-1 p-3 bg-gray-800 rounded-xl text-center">
              <div className="text-xs text-gray-400 font-mono mt-1">Model</div>
              <div className="text-sm font-mono text-white">{result.model_version}</div>
            </div>
          </div>
          <div className="text-xs text-gray-500 font-mono text-center">
            Raw financial data not visible to lenders
          </div>
        </div>
      )}
    </div>
  );
}