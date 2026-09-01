"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type StaffRow = {
  id: string;
  full_name: string;
  email: string;
  status: "invited" | "active" | "revoked";
  created_at: string;
  accepted_at: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  invited: "Invite sent, not accepted yet",
  active: "Active",
  revoked: "Access revoked",
};

const STATUS_COLOR: Record<string, string> = {
  invited: "bg-amber-100 text-amber-800",
  active: "bg-green-100 text-green-800",
  revoked: "bg-slate-200 text-slate-500",
};

export default function TeamPage() {
  const router = useRouter();
  const [authToken, setAuthToken] = useState("");
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [error, setError] = useState("");

  async function loadStaff() {
    const { data } = await supabase.from("landlord_staff").select("id, full_name, email, status, created_at, accepted_at").order("created_at", { ascending: false });
    setStaff((data as StaffRow[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/landlord/login");
        return;
      }
      setAuthToken(data.session.access_token);
      await loadStaff();
    }
    init();
  }, [router]);

  async function sendInvite() {
    setError("");
    setInviteLink("");
    if (!fullName.trim() || !email.trim()) {
      setError("Please enter a name and email address.");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + authToken },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim() }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Could not send invite.");
        return;
      }
      setInviteLink(result.inviteLink);
      setFullName("");
      setEmail("");
      await loadStaff();
    } catch (e: any) {
      setError("Could not reach the server. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this person's access? They will no longer be able to view your portfolio.")) return;
    const res = await fetch("/api/staff/invite?id=" + id, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + authToken },
    });
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      alert("Could not revoke access: " + (result.error || "unknown error"));
      return;
    }
    await loadStaff();
  }

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <a href="/landlord/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-900">&larr; Back to Dashboard</a>

        <div className="mt-4 mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Team &amp; Caretaker Access</h1>
          <p className="mt-1 text-sm text-slate-500">
            Give a caretaker, property manager, or family member a read-only view of maintenance requests, complaints, and announcements &mdash; without sharing your own password or exposing rent, payment, or tenant contact details. They can never change anything.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Invite someone</h2>
          {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {inviteLink && (
            <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
              Invite created. Share this link with them yourself (WhatsApp, SMS, however you&rsquo;d normally reach them) &mdash; Managika doesn&rsquo;t send it for you:
              <div className="mt-2 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-700">{inviteLink}</div>
            </div>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. James Mwangi" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="them@example.com" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
            </div>
          </div>
          <button
            type="button"
            disabled={inviting}
            onClick={sendInvite}
            className="mt-4 rounded-lg bg-amber-500 px-6 py-3 font-semibold text-slate-900 transition hover:bg-amber-400 disabled:opacity-60"
          >
            {inviting ? "Creating invite..." : "Create Invite Link"}
          </button>
        </div>

        <div className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-slate-900">People with access</h2>
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : staff.length === 0 ? (
            <p className="text-sm text-slate-500">Nobody has been invited yet.</p>
          ) : (
            <div className="space-y-3">
              {staff.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{s.full_name}</p>
                    <p className="text-sm text-slate-500">{s.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={"rounded-full px-3 py-1 text-xs font-semibold " + (STATUS_COLOR[s.status] || "bg-slate-100 text-slate-600")}>
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                    {s.status !== "revoked" && (
                      <button type="button" onClick={() => revoke(s.id)} className="text-sm font-medium text-red-600 hover:underline">
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
