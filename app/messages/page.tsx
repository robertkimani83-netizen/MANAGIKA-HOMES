"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { normalizePhone } from "@/lib/tenant-phone";

// Messages tenants send from their own phone (WhatsApp or SMS). Each one is
// matched to the tenant by their phone number, so it shows who and which house.
export default function MessagesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/landlord/login");
        return;
      }
      loadMessages(data.user.id);
    }
    init();
  }, [router]);

  async function loadMessages(landlordId: string) {
    setLoading(true);
    // Only this landlord's own tenants' messages (also enforced in the database).
    const { data, error: loadError } = await supabase
      .from("tenant_messages")
      .select("id, body, channel, kind, read_at, created_at, tenants(full_name, phone_number), units(unit_number)")
      .eq("landlord_id", landlordId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (loadError) setError("Messages could not be loaded (" + loadError.message + "). Please refresh the page.");
    else setMessages((data || []) as any[]);
    setLoading(false);
  }

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    const { error: updateError } = await supabase.from("tenant_messages").update({ read_at: new Date().toISOString() }).in("id", ids);
    if (updateError) { alert("Could not mark as read: " + updateError.message); return; }
    const now = new Date().toISOString();
    setMessages((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, read_at: now } : m)));
  }

  const unread = messages.filter((m) => !m.read_at);

  function whenText(iso: string) {
    return new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Nairobi", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <main className="min-h-screen city-skyline-page">
      <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400" />
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">MANAGIKA HOMES</h1>
            <p className="text-sm text-slate-500">Property Management Made Simple</p>
          </div>
          <a href="/landlord/dashboard" className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700">Dashboard</a>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8 flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-3xl">💬</span>
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Messages</h2>
            <p className="text-slate-500 mt-1">What your tenants send from their own phone by WhatsApp or SMS. Complaints also show on the Complaints page.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <p className="text-sm text-slate-500">Total Messages</p>
            <p className="text-3xl font-bold mt-2">{messages.length}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 border shadow-sm text-white">
            <p className="text-sm text-emerald-100">Not Read Yet</p>
            <p className="text-3xl font-bold mt-2">{unread.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold">All Messages</h3>
            {unread.length > 0 && (
              <button onClick={() => markRead(unread.map((m) => m.id))} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">Mark all as read</button>
            )}
          </div>
          {error && <p className="px-6 py-4 text-sm text-red-600">{error}</p>}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Tenant</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Unit</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Message</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-500">Loading messages...</td></tr>
                ) : messages.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-500">No messages yet. When a tenant WhatsApps or texts from the phone number saved on their account, it will show here.</td></tr>
                ) : (
                  messages.map((m) => {
                    const phone = normalizePhone(m.tenants?.phone_number || "");
                    return (
                      <tr key={m.id} className={"border-t align-top " + (m.read_at ? "" : "bg-emerald-50/60")}>
                        <td className="px-6 py-4">
                          <p className={m.read_at ? "" : "font-semibold"}>{m.tenants?.full_name || "—"}</p>
                          <p className="text-xs text-slate-500">{whenText(m.created_at)}</p>
                        </td>
                        <td className="px-6 py-4">{m.units?.unit_number || "—"}</td>
                        <td className="px-6 py-4">
                          <span className="whitespace-pre-wrap break-words">{m.body}</span>
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{m.channel === "whatsapp" ? "WhatsApp" : "SMS"}</span>
                          {m.kind === "complaint" && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Complaint</span>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {phone && <a href={"https://wa.me/" + phone.replace(/\D/g, "")} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Reply on WhatsApp</a>}
                            {!m.read_at && <button onClick={() => markRead([m.id])} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">Mark read</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <footer className="border-t bg-white mt-10">
        <div className="max-w-7xl mx-auto px-6 py-6 text-sm text-slate-500">© 2026 Managika Homes. Property management made simple.</div>
      </footer>
    </main>
  );
}
