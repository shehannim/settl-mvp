import { useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

export default function Login({ setToken, setUserId, go }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await axios.post(`${API}/api/auth/login`, form);

      const token = res.data.access_token;

      // ✅ Save token
      setToken(token);
      setUserId(res.data.user_id);

      // ✅ IMPORTANT: Store in localStorage
      localStorage.setItem("token", token);

      // ✅ Go to dashboard (FIXED)
      go("dashboard");

    } catch (e) {
      setError(e.response?.data?.detail || "Login failed");
    }

    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-gray-900 rounded-2xl border border-gray-800">
      <div className="text-emerald-400 text-sm font-mono mb-2">
        WELCOME BACK
      </div>

      <h1 className="text-2xl font-bold mb-6">
        Login to Settl
      </h1>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 font-mono uppercase">
            Email
          </label>
          <input
            className="w-full mt-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-emerald-400 outline-none"
            placeholder="kasun@example.com"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 font-mono uppercase">
            Password
          </label>
          <input
            type="password"
            className="w-full mt-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-emerald-400 outline-none"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 text-red-400 text-sm font-mono">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={loading}
        className="w-full mt-6 p-4 bg-emerald-400 text-gray-950 font-bold rounded-xl hover:bg-emerald-300 transition disabled:opacity-50"
      >
        {loading ? "Logging in..." : "Login →"}
      </button>
    </div>
  );
}