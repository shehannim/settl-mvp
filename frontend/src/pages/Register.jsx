import { useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

export default function Register({ setToken, setUserId, go }) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");

    if (!form.full_name.trim()) {
      setError("Full name is required");
      return;
    }

    if (!form.email.trim()) {
      setError("Email is required");
      return;
    }

    if (!form.password || form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      // 1. Register user
      await axios.post(`${API}/api/auth/register`, form);

      // 2. Immediately login after register
      const loginRes = await axios.post(`${API}/api/auth/login`, {
        email: form.email,
        password: form.password,
      });

      const token = loginRes.data.access_token;
      const userId = loginRes.data.user_id;

      // 3. Save token/user
      setToken(token);
      setUserId(userId);

      localStorage.setItem("token", token);

      if (userId) {
        localStorage.setItem("user_id", userId);
      }

      // 4. Go directly to dashboard
      go("dashboard");
          } catch (e) {
      console.error("REGISTER ERROR:", e);
      console.error("BACKEND RESPONSE:", e.response?.data);
      setError(e.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-2xl border border-zinc-200 shadow-sm font-sans">
      <div className="text-zinc-400 text-xs font-medium tracking-wider mb-2 uppercase">
        Create Account
      </div>

      <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-2">
        Join Settl
      </h1>

      <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
        Create your account to start building your alternative credit profile.
      </p>

      <div className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="text-xs text-zinc-400 font-medium tracking-wider uppercase">
            Full name
          </label>

          <input
            className="w-full mt-1.5 p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:bg-white outline-none transition"
            placeholder="Kasun Perera"
            value={form.full_name}
            onChange={(e) =>
              setForm({
                ...form,
                full_name: e.target.value,
              })
            }
          />
        </div>

        {/* Email */}
        <div>
          <label className="text-xs text-zinc-400 font-medium tracking-wider uppercase">
            Email
          </label>

          <input
            type="email"
            className="w-full mt-1.5 p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:bg-white outline-none transition"
            placeholder="kasun@example.com"
            value={form.email}
            onChange={(e) =>
              setForm({
                ...form,
                email: e.target.value,
              })
            }
          />
        </div>

        {/* Password */}
        <div>
          <label className="text-xs text-zinc-400 font-medium tracking-wider uppercase">
            Password
          </label>

          <input
            type="password"
            className="w-full mt-1.5 p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:bg-white outline-none transition"
            placeholder="Min 8 characters"
            value={form.password}
            onChange={(e) =>
              setForm({
                ...form,
                password: e.target.value,
              })
            }
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 text-red-500 text-sm font-medium tracking-wide">
          {error}
        </div>
      )}

      {/* Button */}
      <button
        onClick={submit}
        disabled={loading}
        className="w-full mt-6 p-4 bg-zinc-900 text-white font-semibold rounded-xl hover:bg-zinc-800 transition disabled:opacity-50 tracking-wide"
      >
        {loading ? "Creating account..." : "Create account →"}
      </button>

      {/* Login link */}
      <div className="mt-5 text-center text-sm text-zinc-400">
        Already have an account?{" "}
        <span
          onClick={() => go("login")}
          className="text-zinc-900 font-medium cursor-pointer hover:underline"
        >
          Login
        </span>
      </div>
    </div>
  );
}
