"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function StaffLogin() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleLogin() {
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (loginError) {
      setError(loginError.message);
      return;
    }
    router.push("/staff/dashboard");
  }

  async function handleForgotPassword() {
    setError("");
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: "https://managikahomes.co.ke/staff/reset-password",
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setForgotSent(true);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900">MANAGIKA HOMES</h1>
            <p className="mt-2 text-sm text-slate-500">Caretaker / Team Login</p>
          </div>

          {mode === "forgot" ? (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">Reset Your Password</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {forgotSent ? "Check your email for a reset link." : "Enter your account email and we'll send you a reset link."}
                </p>
              </div>
              {error && <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              {forgotSent ? (
                <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                  If an account exists for {email.trim()}, a password reset link is on its way. Click the link in that email to set a new password.
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Email address</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleForgotPassword}
                    className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {loading ? "Sending..." : "Send Reset Link"}
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setForgotSent(false); }}
                className="mt-6 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to Sign In
              </button>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">Sign In</h2>
                <p className="mt-1 text-sm text-slate-500">View maintenance requests, complaints, and announcements.</p>
              </div>
              {error && <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Email address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setError(""); setForgotSent(false); }}
                      className="text-sm font-medium text-slate-500 hover:text-slate-900"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleLogin}
                  className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {loading ? "Please wait..." : "Sign In"}
                </button>
              </div>
              <p className="mt-6 text-center text-sm text-slate-500">
                Got an invite link from your landlord instead? Use that link to set up your account first.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
