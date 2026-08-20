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
const { data, error } = await supabase
.from("complaints")
.select("id, description, status, created_at, tenants(full_name), units(unit_number)")
.order("created_at", { ascending: false });
if (!error && data) setComplaints(data as any[]);
setLoading(false);
}

async function updateStatus(id: string, status: string) {
const { error } = await supabase.from("complaints").update({ status }).eq("id", id);
if (error) { alert("Error updating status: " + error.message); return; }
loadComplaints();
}

const statusColor: Record<string, string> = {
submitted: "bg-amber-100 text-amber-700",
under_review: "bg-blue-100 text-blue-700",
resolved: "bg-green-100 text-green-700",
};

return (
<main className="min-h-screen bg-gray-100">
<header className="bg-white border-b">
<div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
<div>
<h1 className="text-2xl font-bold text-gray-900">MANAGIKA HOMES</h1>
<p className="text-sm text-gray-500">Property Management Made Simple</p>
</div>
<a href="/landlord/dashboard" className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700">Dashboard</a>
</div>
</header>

  <section className="max-w-7xl mx-auto px-6 py-8">
    <div className="mb-8">
      <h2 className="text-3xl font-bold text-gray-900">Complaints</h2>
      <p className="text-gray-500 mt-1">Private complaints raised by your tenants.</p>
    </div>

    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b">
        <h3 className="text-xl font-semibold">All Complaints</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Tenant</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Unit</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Complaint</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">Loading complaints...</td></tr>
            ) : complaints.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">No complaints have been raised yet.</td></tr>
            ) : (
              complaints.map((c) => (
                <tr key={c.id} className="border-t align-top">
                  <td className="px-6 py-4">{c.tenants?.full_name || "—"}</td>
                  <td className="px-6 py-4">{c.units?.unit_number || "—"}</td>
                  <td className="px-6 py-4">{c.description}</td>
                  <td className="px-6 py-4">
                    <select value={c.status} onChange={(e) => updateStatus(c.id, e.target.value)} className={"rounded-lg px-3 py-1 text-sm font-medium capitalize " + (statusColor[c.status] || "bg-gray-100 text-gray-700")}>
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
    <div className="max-w-7xl mx-auto px-6 py-6 text-sm text-gray-500">© 2026 Managika Homes. Property management made simple.</div>
  </footer>
</main>

);
}