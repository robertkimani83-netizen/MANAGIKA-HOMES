"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const CATEGORIES = [
  { value: "water", label: "Water", color: "bg-blue-100 text-blue-700" },
  { value: "electricity", label: "Electricity", color: "bg-amber-100 text-amber-700" },
  { value: "rent", label: "Rent", color: "bg-emerald-100 text-emerald-700" },
  { value: "security", label: "Security", color: "bg-rose-100 text-rose-700" },
  { value: "garbage", label: "Garbage", color: "bg-slate-100 text-slate-700" },
  { value: "other", label: "Other", color: "bg-purple-100 text-purple-700" },
];

function categoryMeta(value: string) {
  return CATEGORIES.find((c) => c.value === value) || CATEGORIES[CATEGORIES.length - 1];
}

export default function AnnouncementsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [landlordId, setLandlordId] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("other");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/landlord/login"); return; }
      setLandlordId(data.user.id);
      await loadAnnouncements(data.user.id);
      setLoading(false);
    }
    init();
  }, [router]);

  async function loadAnnouncements(id: string) {
    const { data, error: loadError } = await supabase
      .from("announcements")
      .select("id, title, body, category, created_at")
      .eq("landlord_id", id)
      .order("created_at", { ascending: false });
    if (!loadError && data) setAnnouncements(data);
  }

  async function postAnnouncement() {
    if (!landlordId) return;
    if (!title.trim() || !body.trim()) { setError("Title and message are both required."); return; }
    setPosting(true);
    setError(null);
    const { error: insertError } = await supabase.from("announcements").insert({
      landlord_id: landlordId,
      title: title.trim(),
      body: body.trim(),
      category,
    });
    if (insertError) { setError(insertError.message); setPosting(false); return; }
    setTitle("");
    setBody("");
    setCategory("other");
    setShowForm(false);
    await loadAnnouncements(landlordId);
    setPosting(false);
  }

  async function deleteAnnouncement(id: string) {
    if (!landlordId) return;
    if (!confirm("Delete this announcement? Tenants will no longer see it.")) return;
    // .eq("landlord_id", ...) here is defense-in-depth for accidental/curious
    // id-guessing - the RLS policy on this table is the real backstop against
    // a deliberate attempt to delete another landlord's announcement.
    const { error: deleteError } = await supabase.from("announcements").delete().eq("id", id).eq("landlord_id", landlordId);
    if (deleteError) { alert("Error deleting: " + deleteError.message); return; }
    await loadAnnouncements(landlordId);
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MANAGIKA HOMES</h1>
            <p className="text-sm text-gray-500">Property Management Made Simple</p>
          </div>
          <a href="/landlord/dashboard" className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700">Dashboard</a>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-3xl">📣</span>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Announcements</h2>
              <p className="text-gray-500 mt-1">Post a notice and every one of your tenants sees it on their dashboard.</p>
            </div>
          </div>
          <button onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800">
            {showForm ? "Cancel" : "+ New Announcement"}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border shadow-sm p-6 mb-8">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Water supply interruption this Friday" className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
                  {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Message</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Details tenants need to know..." className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <div>
                <button onClick={postAnnouncement} disabled={posting} className="rounded-lg bg-blue-700 px-5 py-3 font-medium text-white hover:bg-blue-800 disabled:opacity-50">
                  {posting ? "Posting..." : "Post to All Tenants"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b"><h3 className="text-xl font-semibold">All Announcements</h3></div>
          <div className="divide-y">
            {loading ? (
              <p className="px-6 py-10 text-center text-gray-500">Loading announcements...</p>
            ) : announcements.length === 0 ? (
              <p className="px-6 py-10 text-center text-gray-500">No announcements posted yet.</p>
            ) : (
              announcements.map((a) => {
                const meta = categoryMeta(a.category);
                return (
                  <div key={a.id} className="px-6 py-5 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={"px-2 py-0.5 rounded text-xs font-semibold " + meta.color}>{meta.label}</span>
                        <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                      <p className="font-semibold text-gray-900">{a.title}</p>
                      <p className="text-gray-600 mt-1 whitespace-pre-wrap">{a.body}</p>
                    </div>
                    <button onClick={() => deleteAnnouncement(a.id)} className="shrink-0 text-sm text-rose-600 hover:underline">Delete</button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <footer className="border-t bg-white mt-10">
        <div className="max-w-5xl mx-auto px-6 py-6 text-sm text-gray-500">© 2026 Managika Homes. Property management made simple.</div>
      </footer>
    </main>
  );
}
