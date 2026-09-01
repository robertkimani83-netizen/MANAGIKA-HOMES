"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Normalizes a Kenyan phone number to E.164 (+254XXXXXXXXX) so it matches
// the format Supabase Auth stores in auth.users.phone. Accepts the formats
// landlords actually enter: 07XXXXXXXX, 254XXXXXXXXX, +254XXXXXXXXX, 7XXXXXXXX.
function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") && digits.length === 12 && digits.startsWith("254")) {
    return "+" + digits;
  }
  if (digits.length === 12 && digits.startsWith("254")) {
    return "+" + digits;
  }
  if (digits.length === 10 && digits.startsWith("0")) {
    return "+254" + digits.slice(1);
  }
  if (digits.length === 9) {
    return "+254" + digits;
  }
  return null;
}

function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

export default function TenantLogin() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    if (!identifier.trim() || !password) {
      setError("Please enter your email or phone number, and your password.");
      return;
    }

    const value = identifier.trim();
    setLoading(true);

    let loginError;
    if (looksLikeEmail(value)) {
      ({ error: loginError } = await supabase.auth.signInWithPassword({
        email: value,
        password,
      }));
    } else {
      const phone = normalizePhone(value);
      if (!phone) {
        setLoading(false);
        setError("Enter a valid email address or phone number (e.g. 07XXXXXXXX).");
        return;
      }
      ({ error: loginError } = await supabase.auth.signInWithPassword({
        phone,
        password,
      }));
    }

    setLoading(false);
    if (loginError) {
      setError(loginError.message);
      return;
    }
    router.push("/tenant/dashboard");
  }

  async function handleSignup() {
    setError("");
    if (!identifier.trim() || !password) {
      setError("Please enter your email or phone number, and a password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const value = identifier.trim();

    if (looksLikeEmail(value)) {
      await handleEmailSignup(value);
    } else {
      await handlePhoneSignup(value);
    }
  }

  async function handleEmailSignup(email: string) {
    setLoading(true);

    const { data: emailExists } = await supabase.rpc("check_tenant_email", {
      check_email: email,
    });

    if (!emailExists) {
      setLoading(false);
      setError("This email is not registered as a tenant by your landlord. Please contact them first.");
      return;
    }

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "https://managikahomes.co.ke/tenant/login",
      },
    });
    setLoading(false);
    if (signupError) {
      setError(signupError.message);
      return;
    }
    if (data.session) {
      router.push("/tenant/dashboard");
    } else {
      setError("Account created. Check your email to confirm, then log in.");
      setMode("login");
    }
  }

  async function handlePhoneSignup(value: string) {
    const phone = normalizePhone(value);
    if (!phone) {
      setError("Enter a valid phone number (e.g. 07XXXXXXXX) or an email address.");
      return;
    }
    setLoading(true);

    let signupRes;
    try {
      const res = await fetch("/api/tenants/signup-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      signupRes = await res.json();
      if (!res.ok) {
        setLoading(false);
        setError(signupRes.error || "Could not create your account. Please try again.");
        return;
      }
    } catch (e) {
      setLoading(false);
      setError("Could not reach the server. Please try again.");
      return;
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({ phone, password });
    setLoading(false);
    if (loginError) {
      setError("Account created. Please sign in with your new password.");
      setMode("login");
      return;
    }
    router.push("/tenant/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900">MANAGIKA HOMES</h1>
            <p className="mt-2 text-sm text-slate-500">Tenant Portal</p>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">{mode === "login" ? "Tenant Login" : "Tenant Sign Up"}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "login" ? "Sign in with your email or phone number to view your home, rent and payments." : "Use the email or phone number your landlord registered you with."}
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Email or Phone Number</label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com or 07XXXXXXXX"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={mode === "login" ? handleLogin : handleSignup}
              className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">OR</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            {mode === "login" ? "First time? Set up your account" : "Already have an account? Sign In"}
          </button>

          <p className="mt-6 text-center text-sm text-slate-500">
            Are you a landlord?{" "}
            <a href="/landlord/login" className="font-semibold text-slate-900 hover:underline">Landlord Login</a>
          </p>

          <div className="mt-6 text-center">
            <a href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900">← Back to Managika Homes</a>
          </div>
        </div>
      </div>
    </main>

  );
}
