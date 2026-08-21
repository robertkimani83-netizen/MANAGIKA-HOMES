"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Unit = { id: string; unit_number: string; base_rent: number; status: string; property_id: string; properties: { property_name: string } | null };

type Tenant = { id: string; full_name: string; phone_number: string; email: string | null; status: string; unit_id: string | null; units: { unit_number: string; base_rent: number; properties: { property_name: string } | null } | null };

export default function TenantsPage() {
const router = useRouter();
const [landlordId, setLandlordId] = useState<string | null>(null);
const [tenants, setTenants] = useState<Tenant[]>([]);
const [vacantUnits, setVacantUnits] = useState<Unit[]>([]);
const [loading, setLoading] = useState(true);
const [showForm, setShowForm] = useState(false);
const [fullName, setFullName] = useState("");
const [phone, setPhone] = useState("");
const [email, setEmail] = useState("");
const [unitId, setUnitId] = useState("");

useEffect(() => {
async function init() {
const { data: { user } } = await supabase.auth.getUser();
if (!user) { router.push("/landlord/login"); return; }
setLandlordId(user.id);
}
init();
}, [router]);

async function loadVacantUnits(id: string) {
const { data, error } = await supabase.from("units").select("id, unit_number, base_rent, status, property_id, properties!inner(property_name, landlord_id)").eq("status", "vacant").eq("properties.landlord_id", id).order("unit_number", { ascending: true });
if (error) { console.error("Vacant units error:", error); setVacantUnits([]); return; }
setVacantUnits(data as unknown as Unit[]);
}

async function loadTenants(id: string) {
setLoading(true);
const { data, error } = await supabase.from("tenants").select("id, full_name, phone_number, email, status, unit_id, units!inner(unit_number, base_rent, property_id, properties!inner(property_name, landlord_id))").eq("landlord_id", id).order("created_at", { ascending: false });
if (error) { console.error("Tenants error:", error); setTenants([]); } else if (data) { setTenants(data as unknown as Tenant[]); }
setLoading(false);
}

useEffect(() => {
if (!landlordId) return;
loadVacantUnits(landlordId);
loadTenants(landlordId);
}, [landlordId]);

async function addTenant() {
if (!landlordId) return;
if (!fullName.trim()) { alert("Please enter the tenant's name."); return; }
if (!phone.trim()) { alert("Please enter the tenant's phone number."); return; }
if (unitId) {
const selectedUnit = vacantUnits.find((unit) => unit.id === unitId);
if (!selectedUnit) { alert("Invalid unit selected."); return; }
}
const { error: tenantError } = await supabase.from("tenants").insert({ landlord_id: landlordId, full_name: fullName.trim(), phone_number: phone.trim(), email: email.trim() || null, unit_id: unitId || null, status: "active", joined_at: new Date().toISOString() });
if (tenantError) { alert("Error saving tenant: " + tenantError.message); return; }
if (unitId) {
const { error: unitError } = await supabase.from("units").update({ status: "occupied" }).eq("id", unitId);
if (unitError) console.error("Unit status error:", unitError);
}
setFullName(""); setPhone(""); setEmail(""); setUnitId(""); setShowForm(false);
await loadVacantUnits(landlordId);
await loadTenants(landlordId);
}

async function deleteTenant(tenant: Tenant) {
if (!landlordId) return;
const confirmed = window.confirm("Are you sure you want to remove this tenant?");
if (!confirmed) return;
const { error } = await supabase.from("tenants").delete().eq("id", tenant.id).eq("landlord_id", landlordId);
if (error) { alert("Error removing tenant: " + error.message); return; }
if (tenant.unit_id) {
const { error: unitError } = await supabase.from("units").update({ status: "vacant" }).eq("id", tenant.unit_id);
if (unitError) console.error("Unit status error:", unitError);
}
await loadVacantUnits(landlordId);
await loadTenants(landlordId);
}

const totalTenants = tenants.length;
const activeTenants = tenants.filter((tenant) => tenant.status === "active").length;
const totalRent = tenants.reduce((sum, tenant) => sum + (Number(tenant.units?.base_rent) || 0), 0);

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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-3xl">👥</span>
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Tenants</h2>
          <p className="text-slate-500 mt-1">Manage tenants, assignments and rental information.</p>
        </div>
      </div>
      <button onClick={() => setShowForm(true)} className="px-5 py-3 rounded-lg bg-slate-900 text-white font-medium shadow-lg shadow-slate-900/10 hover:-translate-y-0.5 hover:bg-slate-800 transition">+ Add Tenant</button>
    </div>

    {showForm && (
      <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-xl font-bold text-slate-900">Add New Tenant</h3>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. John Kamau" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Phone Number</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0712345678" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Email (optional)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. john@email.com" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Assign to Unit</label>
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
              <option value="">No unit yet</option>
              {vacantUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.properties?.property_name} - {unit.unit_number} (KSh {Number(unit.base_rent).toLocaleString()})</option>
              ))}
            </select>
            {vacantUnits.length === 0 && (<p className="mt-2 text-sm text-slate-500">No vacant units available. Add units first, or leave unassigned.</p>)}
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={addTenant} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800">Save Tenant</button>
          <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    )}

    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 border shadow-sm text-white">
        <p className="text-sm text-slate-300">Total Tenants</p>
        <p className="text-3xl font-bold mt-2">{totalTenants}</p>
      </div>
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-slate-500">Active Tenants</p>
        <p className="text-3xl font-bold mt-2">{activeTenants}</p>
      </div>
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-slate-500">Total Monthly Rent</p>
        <p className="text-3xl font-bold mt-2">KSh {totalRent.toLocaleString()}</p>
      </div>
    </div>

    <div className="mt-8 bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b"><h3 className="text-xl font-semibold">Tenant Information</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Tenant</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Phone</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Property</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Unit</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Rent</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">Loading tenants...</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">No tenants have been added yet.</td></tr>
            ) : (
              tenants.map((tenant) => (
                <tr key={tenant.id} className="border-t">
                  <td className="px-6 py-4"><a href={"/tenants/" + tenant.id} className="font-medium text-amber-600 hover:underline">{tenant.full_name}</a></td>
                  <td className="px-6 py-4">{tenant.phone_number}</td>
                  <td className="px-6 py-4">{tenant.units?.properties?.property_name || "—"}</td>
                  <td className="px-6 py-4">{tenant.units?.unit_number || "Unassigned"}</td>
                  <td className="px-6 py-4">{tenant.units ? "KSh " + Number(tenant.units.base_rent).toLocaleString() : "—"}</td>
                  <td className="px-6 py-4"><button onClick={() => deleteTenant(tenant)} className="text-sm font-medium text-red-600 hover:underline">Remove</button></td>
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