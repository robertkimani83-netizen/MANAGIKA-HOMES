"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Tenant = { id: string; full_name: string; unit_id: string | null; units: { unit_number: string; properties: { property_name: string; landlord_id: string } | null } | null };

type Request = { id: string; category: string; title: string; description: string; urgency: string; status: string; technician_name: string | null; repair_cost: number; created_at: string; tenant_id: string | null; unit_id: string | null; tenants: { full_name: string } | null; units: { unit_number: string; properties: { property_name: string; landlord_id: string } | null } | null };

export default function MaintenancePage() {
const router = useRouter();
const [landlordId, setLandlordId] = useState<string | null>(null);
const [tenants, setTenants] = useState<Tenant[]>([]);
const [requests, setRequests] = useState<Request[]>([]);
const [loading, setLoading] = useState(true);
const [showForm, setShowForm] = useState(false);
const [tenantId, setTenantId] = useState("");
const [category, setCategory] = useState("plumbing");
const [title, setTitle] = useState("");
const [description, setDescription] = useState("");
const [urgency, setUrgency] = useState("normal");

useEffect(() => {
async function init() {
const { data: { user } } = await supabase.auth.getUser();
if (!user) { router.push("/landlord/login"); return; }
setLandlordId(user.id);
}
init();
}, [router]);

async function loadTenants(id: string) {
const { data, error } = await supabase.from("tenants").select("id, full_name, unit_id, units!inner(unit_number, properties!inner(property_name, landlord_id))").eq("status", "active").eq("units.properties.landlord_id", id).order("full_name", { ascending: true });
if (!error && data) setTenants(data as unknown as Tenant[]);
}

async function loadRequests(id: string) {
setLoading(true);
const { data, error } = await supabase.from("maintenance_requests").select("id, category, title, description, urgency, status, technician_name, repair_cost, created_at, tenant_id, unit_id, tenants(full_name), units!inner(unit_number, properties!inner(property_name, landlord_id))").eq("units.properties.landlord_id", id).order("created_at", { ascending: false });
if (!error && data) setRequests(data as unknown as Request[]);
setLoading(false);
}

useEffect(() => {
if (!landlordId) return;
loadTenants(landlordId);
loadRequests(landlordId);
}, [landlordId]);

async function addRequest() {
if (!landlordId) { alert("You are not logged in."); return; }
if (!tenantId) { alert("Please select a tenant."); return; }
if (!title.trim()) { alert("Please enter a short title for the issue."); return; }
if (!description.trim()) { alert("Please describe the issue."); return; }
const tenant = tenants.find((t) => t.id === tenantId);
if (!tenant) { alert("Tenant not found."); return; }
if (!tenant.unit_id) { alert("This tenant has no unit assigned."); return; }
const { error } = await supabase.from("maintenance_requests").insert({ tenant_id: tenantId, unit_id: tenant.unit_id, category, title: title.trim(), description: description.trim(), urgency, status: "submitted" });
if (error) { alert("Error logging request: " + error.message); return; }
setTenantId(""); setCategory("plumbing"); setTitle(""); setDescription(""); setUrgency("normal"); setShowForm(false);
await loadRequests(landlordId);
}

async function updateStatus(id: string, status: string) {
if (!landlordId) return;
const request = requests.find((r) => r.id === id);
if (!request) { alert("Maintenance request not found."); return; }
const { error } = await supabase.from("maintenance_requests").update({ status }).eq("id", id);
if (error) { alert("Error updating status: " + error.message); return; }
await loadRequests(landlordId);
}

async function deleteRequest(id: string) {
if (!landlordId) return;
const confirmed = window.confirm("Are you sure you want to remove this maintenance request?");
if (!confirmed) return;
const request = requests.find((r) => r.id === id);
if (!request) { alert("Maintenance request not found."); return; }
const { error } = await supabase.from("maintenance_requests").delete().eq("id", id);
if (error) { alert("Error removing request: " + error.message); return; }
await loadRequests(landlordId);
}

const openCount = requests.filter((r) => r.status !== "completed").length;
const urgentCount = requests.filter((r) => r.urgency === "urgent" && r.status !== "completed").length;

const statusColor: Record<string, string> = {
submitted: "bg-amber-100 text-amber-700",
assigned: "bg-blue-100 text-blue-700",
in_progress: "bg-blue-100 text-blue-700",
completed: "bg-green-100 text-green-700",
};

return (
<main className="min-h-screen bg-slate-50">
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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-3xl">🔧</span>
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Maintenance</h2>
          <p className="text-slate-500 mt-1">Track repair requests and keep your properties in good condition.</p>
        </div>
      </div>
      <button onClick={() => setShowForm(true)} className="px-5 py-3 rounded-lg bg-slate-900 text-white font-medium shadow-lg shadow-slate-900/10 hover:-translate-y-0.5 hover:bg-slate-800 transition">+ Log Request</button>
    </div>

    {showForm && (
      <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-xl font-bold text-slate-900">Log Maintenance Request</h3>
        {tenants.length === 0 ? (
          <p className="text-slate-500">Add a tenant with a unit assigned first.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Tenant / Unit</label>
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
                <option value="">Select tenant</option>
                {tenants.map((t) => (<option key={t.id} value={t.id}>{t.full_name} — {t.units?.unit_number || "No unit"}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="structural">Structural</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Short Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kitchen sink leaking" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Urgency</label>
              <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Describe the issue..." className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <button onClick={addRequest} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800">Save Request</button>
          <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    )}

    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-slate-500">Open Requests</p>
        <p className="text-3xl font-bold mt-2">{openCount}</p>
      </div>
      <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 border shadow-sm text-white">
        <p className="text-sm text-red-100">Urgent</p>
        <p className="text-3xl font-bold mt-2">{urgentCount}</p>
      </div>
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-slate-500">Total Logged</p>
        <p className="text-3xl font-bold mt-2">{requests.length}</p>
      </div>
    </div>

    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b"><h3 className="text-xl font-semibold">Requests</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Unit</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Tenant</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Issue</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Urgency</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">Loading requests...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">No maintenance requests logged yet.</td></tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-6 py-4">{r.units?.unit_number || "—"}</td>
                  <td className="px-6 py-4">{r.tenants?.full_name || "—"}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{r.title}</div>
                    <div className="text-sm text-slate-500">{r.description}</div>
                  </td>
                  <td className="px-6 py-4 capitalize">{r.urgency === "urgent" ? (<span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">Urgent</span>) : "Normal"}</td>
                  <td className="px-6 py-4">
                    <select value={r.status} onChange={(e) => updateStatus(r.id, e.target.value)} className={"rounded-lg px-3 py-1 text-sm font-medium capitalize " + (statusColor[r.status] || "bg-slate-100 text-slate-700")}>
                      <option value="submitted">Submitted</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>
                  <td className="px-6 py-4"><button onClick={() => deleteRequest(r.id)} className="text-sm font-medium text-red-600 hover:underline">Remove</button></td>
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