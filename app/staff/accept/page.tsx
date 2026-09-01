"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function AcceptInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setError("");
    if (!token) {
      setError("This invite link is missing its token. Ask your landlord to send it again.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/staff/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const result = await res.json();
      if (!res.ok) {
        setLoading(false);
        setError(result.error || "Could not set up your account.");
        return;
      }
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: result.email, password });
      setLoading(false);
      if (loginError) {
        router.push("/staff/login");
        return;
      }
      router.push("/staff/dashboard");
    } catch (e: any) {
      setLoading(false);
      setError("Could not reach the server. Please try again.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900">MANAGIKA HOMES</h1>
            <p className="mt-2 text-sm text-slate-500">Set up your team access</p>
          </div>
          <p className="mb-6 text-sm text-slate-500">
            Your landlord has given you read-only access to maintenance requests, complaints, and announcements. Set a password to finish creating your account &mdash; you&rsquo;ll never see rent or payment details, and you can&rsquo;t change anything.
          </p>
          {error && <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Choose a Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleAccept}
              className="w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-slate-900 transition hover:bg-amber-400 disabled:opacity-60"
            >
              {loading ? "Setting up..." : "Create Account"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function StaffAccept() {
  return (
    <Suspense fallback={null}>
      <AcceptInner />
    </Suspense>
  );
}
