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
    <div className="max-w-md mx-auto mt-20 p-8 bg-gray-900 rounded-2xl border border-gray-800">
      <div className="text-emerald-400 text-sm font-mono mb-2">
        CREATE ACCOUNT
      </div>

      <h1 className="text-2xl font-bold mb-2">Join Settl</h1>

      <p className="text-gray-400 text-sm mb-6">
        Create your account to start building your alternative credit profile.
      </p>

      <div className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="text-xs text-gray-400 font-mono uppercase">
            Full name
          </label>

          <input
            className="w-full mt-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-emerald-400 outline-none"
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
          <label className="text-xs text-gray-400 font-mono uppercase">
            Email
          </label>

          <input
            type="email"
            className="w-full mt-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-emerald-400 outline-none"
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
          <label className="text-xs text-gray-400 font-mono uppercase">
            Password
          </label>

          <input
            type="password"
            className="w-full mt-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-emerald-400 outline-none"
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
        <div className="mt-4 text-red-400 text-sm font-mono">
          {error}
        </div>
      )}

      {/* Button */}
      <button
        onClick={submit}
        disabled={loading}
        className="w-full mt-6 p-4 bg-emerald-400 text-gray-950 font-bold rounded-xl hover:bg-emerald-300 transition disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create account →"}
      </button>

      {/* Login link */}
      <div className="mt-4 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <span
          onClick={() => go("login")}
          className="text-emerald-400 cursor-pointer hover:text-emerald-300"
        >
          Login
        </span>
      </div>
    </div>
  );
}