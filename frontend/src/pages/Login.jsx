import { useState } from "react";
import axios from "axios";

const API = "https://settl-backend-s3rc.onrender.com";

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

      setToken(token);
      setUserId(res.data.user_id);
      localStorage.setItem("token", token);
      go("dashboard");
    } catch (e) {
      if (e.response) {
        setError(e.response.data.detail || "Invalid login");
      } else {
        setError("Cannot connect to server");
      }
    }

    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-2xl border border-zinc-200 shadow-sm font-sans">
      <div className="text-zinc-400 text-xs font-medium tracking-wider mb-2 uppercase">
        WELCOME BACK
      </div>

      <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-6">
        Login to Settl
      </h1>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-zinc-400 font-medium tracking-wider uppercase">
            Email
          </label>
          <input
            className="w-full mt-1.5 p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:bg-white outline-none transition"
            placeholder="email@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs text-zinc-400 font-medium tracking-wider uppercase">
            Password
          </label>
          <input
            type="password"
            className="w-full mt-1.5 p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:border-zinc-900 focus:bg-white outline-none transition"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 text-red-500 text-sm font-medium tracking-wide">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={loading}
        className="w-full mt-6 p-4 bg-zinc-900 text-white font-semibold rounded-xl hover:bg-zinc-800 transition disabled:opacity-50 tracking-wide"
      >
        {loading ? "Logging in..." : "Login →"}
      </button>
    </div>
  );
}
