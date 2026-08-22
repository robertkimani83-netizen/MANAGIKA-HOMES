"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  portfolio: "Portfolio",
};

function LandlordLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");
  const plan = planParam && PLAN_NAMES[planParam] ? planParam : null;

  const [mode, setMode] = useState<"login" | "signup">(plan ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function destinationAfterAuth() {
    return plan ? "/landlord/billing?plan=" + plan : "/landlord/dashboard";
  }

  async function handleLogin() {
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (loginError) {
      setError(loginError.message);
      return;
    }
    router.push(destinationAfterAuth());
  }

  async function handleSignup() {
    setError("");
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: "https://managikahomes.co.ke/landlord/login",
      },
    });
    if (signupError) {
      setLoading(false);
      setError(signupError.message);
      return;
    }
    if (data.user) {
      await supabase.from("landlords").insert({
        id: data.user.id,
        full_name: fullName.trim(),
        email: email.trim(),
        phone_number: phone.trim(),
      });
    }
    setLoading(false);
    if (data.session) {
      router.push(destinationAfterAuth());
    } else {
      setError("Account created. Check your email to confirm, then log in.");
      setMode("login");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900">MANAGIKA HOMES</h1>
            <p className="mt-2 text-sm text-slate-500">Landlord Portal</p>
          </div>

          {plan && (
            <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Signing up for the {PLAN_NAMES[plan]} plan — you&rsquo;ll pick your payment method right after this.
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">{mode === "login" ? "Landlord Login" : "Create Landlord Account"}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "login" ? "Sign in to manage your properties and tenants." : "Set up your landlord account."}
            </p>
          </div>
          {error && (
            <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          <div className="space-y-5">
            {mode === "signup" && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Full Name</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Robert Kimani" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Phone Number</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +97430849847" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
                </div>
              </>
            )}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
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
            {mode === "login" ? "Create Landlord Account" : "Already have an account? Sign In"}
          </button>
          <p className="mt-6 text-center text-sm text-slate-500">
            Are you a tenant?{" "}
            <a href="/tenant/login" className="font-semibold text-slate-900 hover:underline">Tenant Login</a>
          </p>
          <div className="mt-6 text-center">
            <a href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900">← Back to Managika Homes</a>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LandlordLogin() {
  return (
    <Suspense fallback={null}>
      <LandlordLoginInner />
    </Suspense>
  );
}
