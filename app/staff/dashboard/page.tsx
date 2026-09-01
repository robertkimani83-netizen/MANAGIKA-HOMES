"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Summary = {
  maintenance: { id: string; title: string; category: string; urgency: string; status: string; unitNumber: string | null; createdAt: string }[];
  complaints: { id: string; description: string; status: string; unitNumber: string | null; createdAt: string }[];
  announcements: { id: string; title: string; body: string; category: string; createdAt: string }[];
};

export default function StaffDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/staff/login");
        return;
      }
      try {
        const res = await fetch("/api/staff/summary", {
          headers: { Authorization: "Bearer " + data.session.access_token },
        });
        const result = await res.json();
        if (!res.ok) {
          setError(result.error || "Could not load this portfolio.");
          setLoading(false);
          return;
        }
        setSummary(result);
      } catch (e) {
        setError("Could not reach the server.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/staff/login");
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-gray-100 text-slate-500">Loading...</main>;
  }

  if (error || !summary) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-red-700">{error || "Nothing to show."}</p>
          <button onClick={signOut} className="mt-4 text-sm font-medium text-slate-500 hover:underline">Sign out</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Maintenance &amp; Announcements</h1>
            <p className="mt-1 text-sm text-slate-500">Read-only view of what needs attention around the property.</p>
          </div>
          <button onClick={signOut} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Sign Out
          </button>
        </div>

        <div className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-slate-900">Maintenance Requests</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {summary.maintenance.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Nothing outstanding.</p>
            ) : (
              summary.maintenance.map((m) => (
                <div key={m.id} className="border-b border-slate-100 px-5 py-4 last:border-0">
                  <p className="font-semibold text-slate-900">{m.title} &mdash; Unit {m.unitNumber || "—"}</p>
                  <p className="text-sm text-slate-500">{m.category} &middot; {m.urgency} urgency &middot; {m.status}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-slate-900">Complaints</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {summary.complaints.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No complaints logged.</p>
            ) : (
              summary.complaints.map((c) => (
                <div key={c.id} className="border-b border-slate-100 px-5 py-4 last:border-0">
                  <p className="text-slate-900">{c.description}</p>
                  <p className="text-sm text-slate-500">Unit {c.unitNumber || "—"} &middot; {c.status}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold text-slate-900">Announcements</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {summary.announcements.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No announcements posted.</p>
            ) : (
              summary.announcements.map((a) => (
                <div key={a.id} className="border-b border-slate-100 px-5 py-4 last:border-0">
                  <p className="font-semibold text-slate-900">{a.title}</p>
                  <p className="text-sm text-slate-600">{a.body}</p>
                  <p className="mt-1 text-xs text-slate-400 capitalize">{a.category}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
