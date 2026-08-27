"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ComplaintsPage() {
const router = useRouter();
const [loading, setLoading] = useState(true);
const [complaints, setComplaints] = useState<any[]>([]);

useEffect(() => {
async function init() {
const { data } = await supabase.auth.getUser();
if (!data.user) {
router.push("/landlord/login");
return;
}
loadComplaints();
}
init();
}, [router]);

async function loadComplaints() {
setLoading(true);
const { data: userData } = await supabase.auth.getUser();
const landlordId = userData.user?.id;
if (!landlordId) { setLoading(false); return; }
// Scoped to this landlord's own properties via the units -> properties join -
// without this filter, any logged-in landlord could read every other
// landlord's tenant complaints (private text) on this page.
const { data, error } = await supabase
.from("complaints")
.select("id, description, status, created_at, tenants(full_name), units!inner(unit_number, properties!inner(landlord_id))")
.eq("units.properties.landlord_id", landlordId)
.order("created_at", { ascending: false });
if (!error && data) setComplaints(data as any[]);
setLoading(false);
}

async function updateStatus(id: string, status: string) {
const { data: sessionData } = await supabase.auth.getSession();
const token = sessionData.session?.access_token || "";
const res = await fetch("/api/complaints/" + id, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
  body: JSON.stringify({ status }),
});
const result = await res.json();
if (!res.ok) { alert("Error updating status: " + (result.error || "unknown error")); return; }
loadComplaints();
}

const statusColor: Record<string, string> = {
submitted: "bg-amber-100 text-amber-700",
under_review: "bg-blue-100 text-blue-700",
resolved: "bg-green-100 text-green-700",
};

const openCount = complaints.filter((c) => c.status !== "resolved").length;

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
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-3xl">📢</span>
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Complaints</h2>
        <p className="text-slate-500 mt-1">Private complaints raised by your tenants.</p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-slate-500">Total Complaints</p>
        <p className="text-3xl font-bold mt-2">{complaints.length}</p>
      </div>
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 border shadow-sm text-white">
        <p className="text-sm text-amber-100">Open (Not Resolved)</p>
        <p className="text-3xl font-bold mt-2">{openCount}</p>
      </div>
    </div>

    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b">
        <h3 className="text-xl font-semibold">All Complaints</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Tenant</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Unit</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Complaint</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-500">Loading complaints...</td></tr>
            ) : complaints.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-500">No complaints have been raised yet.</td></tr>
            ) : (
              complaints.map((c) => (
                <tr key={c.id} className="border-t align-top">
                  <td className="px-6 py-4">{c.tenants?.full_name || "—"}</td>
                  <td className="px-6 py-4">{c.units?.unit_number || "—"}</td>
                  <td className="px-6 py-4">{c.description}</td>
                  <td className="px-6 py-4">
                    <select value={c.status} onChange={(e) => updateStatus(c.id, e.target.value)} className={"rounded-lg px-3 py-1 text-sm font-medium capitalize " + (statusColor[c.status] || "bg-slate-100 text-slate-700")}>
                      <option value="submitted">Submitted</option>
                      <option value="under_review">Under Review</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </td>
                </tr>
              ))
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