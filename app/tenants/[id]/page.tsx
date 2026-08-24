"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function TenantDetailPage() {
const router = useRouter();
const params = useParams();
const tenantId = params.id as string;

const [loading, setLoading] = useState(true);
const [tenant, setTenant] = useState<any>(null);
const [invoices, setInvoices] = useState<any[]>([]);
const [maintenance, setMaintenance] = useState<any[]>([]);
const [complaints, setComplaints] = useState<any[]>([]);
const [landlordId, setLandlordId] = useState<string | null>(null);
const [unitOptions, setUnitOptions] = useState<any[]>([]);
const [selectedUnitId, setSelectedUnitId] = useState("");
const [savingUnit, setSavingUnit] = useState(false);
const [unitMessage, setUnitMessage] = useState<string | null>(null);

useEffect(() => {
async function init() {
const { data } = await supabase.auth.getUser();
if (!data.user) { router.push("/landlord/login"); return; }
setLandlordId(data.user.id);

  const { data: tenantRow } = await supabase.from("tenants").select("id, full_name, phone_number, email, status, joined_at, unit_id, units(unit_number, base_rent, properties(property_name))").eq("id", tenantId).single();
  if (!tenantRow) { router.push("/tenants"); return; }
  setTenant(tenantRow);
  setSelectedUnitId(tenantRow.unit_id || "");

  const { data: vacantRows } = await supabase.from("units").select("id, unit_number, base_rent, status, property_id, properties!inner(property_name, landlord_id)").eq("status", "vacant").eq("properties.landlord_id", data.user.id).order("unit_number", { ascending: true });
  let options = vacantRows || [];
  if (tenantRow.unit_id) {
    const { data: currentUnitRow } = await supabase.from("units").select("id, unit_number, base_rent, status, property_id, properties(property_name, landlord_id)").eq("id", tenantRow.unit_id).single();
    if (currentUnitRow && !options.find((u: any) => u.id === currentUnitRow.id)) {
      options = [currentUnitRow, ...options];
    }
  }
  setUnitOptions(options);

  const { data: invoiceRows } = await supabase.from("invoices").select("id, billing_period, total_due, status, due_date").eq("tenant_id", tenantId).order("due_date", { ascending: false });
  setInvoices(invoiceRows || []);

  const { data: maintenanceRows } = await supabase.from("maintenance_requests").select("id, title, description, urgency, status, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  setMaintenance(maintenanceRows || []);

  const { data: complaintRows } = await supabase.from("complaints").select("id, description, status, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  setComplaints(complaintRows || []);

  setLoading(false);
}
init();

}, [router, tenantId]);

async function saveUnit() {
if (!landlordId) return;
setSavingUnit(true);
setUnitMessage(null);
const previousUnitId = tenant.unit_id;
const newUnitId = selectedUnitId || null;

const { error: tenantError } = await supabase.from("tenants").update({ unit_id: newUnitId }).eq("id", tenantId);
if (tenantError) { setUnitMessage("Error: " + tenantError.message); setSavingUnit(false); return; }

if (previousUnitId && previousUnitId !== newUnitId) {
  await supabase.from("units").update({ status: "vacant" }).eq("id", previousUnitId);
}
if (newUnitId) {
  await supabase.from("units").update({ status: "occupied" }).eq("id", newUnitId);
}

const { data: refreshedTenant } = await supabase.from("tenants").select("id, full_name, phone_number, email, status, joined_at, unit_id, units(unit_number, base_rent, properties(property_name))").eq("id", tenantId).single();
if (refreshedTenant) setTenant(refreshedTenant);

const { data: vacantRows } = await supabase.from("units").select("id, unit_number, base_rent, status, property_id, properties!inner(property_name, landlord_id)").eq("status", "vacant").eq("properties.landlord_id", landlordId).order("unit_number", { ascending: true });
let options = vacantRows || [];
if (newUnitId) {
  const { data: currentUnitRow } = await supabase.from("units").select("id, unit_number, base_rent, status, property_id, properties(property_name, landlord_id)").eq("id", newUnitId).single();
  if (currentUnitRow && !options.find((u: any) => u.id === currentUnitRow.id)) {
    options = [currentUnitRow, ...options];
  }
}
setUnitOptions(options);

setUnitMessage("Saved.");
setSavingUnit(false);
}

if (loading || !tenant) {
return (<main className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500">Loading tenant details...</main>);
}

return (
<main className="min-h-screen bg-gray-100">
<header className="bg-white border-b">
<div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
<div>
<h1 className="text-2xl font-bold text-gray-900">MANAGIKA HOMES</h1>
<p className="text-sm text-gray-500">Property Management Made Simple</p>
</div>
<a href="/tenants" className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700">Back to Tenants</a>
</div>
</header>

  <section className="max-w-5xl mx-auto px-6 py-8">
    <div className="mb-8">
      <h2 className="text-3xl font-bold text-gray-900">{tenant.full_name}</h2>
      <p className="text-gray-500 mt-1">{tenant.units ? tenant.units.properties?.property_name + " — Unit " + tenant.units.unit_number : "No unit assigned"}</p>
    </div>

    <div className="bg-white rounded-xl border shadow-sm p-6 mb-8">
      <h3 className="text-xl font-semibold mb-4">Unit Assignment</h3>
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-gray-700">Unit</label>
          <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
            <option value="">No unit assigned</option>
            {unitOptions.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.properties?.property_name} - {unit.unit_number} (KSh {Number(unit.base_rent).toLocaleString()})</option>
            ))}
          </select>
        </div>
        <button onClick={saveUnit} disabled={savingUnit} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50">
          {savingUnit ? "Saving..." : "Save"}
        </button>
      </div>
      {unitMessage && <p className="mt-3 text-sm text-gray-600">{unitMessage}</p>}
    </div>

    <div className="bg-white rounded-xl border shadow-sm p-6 mb-8">
      <h3 className="text-xl font-semibold mb-4">Contact & Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <p className="text-sm text-gray-500">Phone Number</p>
          <p className="font-medium">{tenant.phone_number || "—"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Email</p>
          <p className="font-medium">{tenant.email || "Not set"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Status</p>
          <p className="font-medium capitalize">{tenant.status}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Joined</p>
          <p className="font-medium">{tenant.joined_at ? new Date(tenant.joined_at).toLocaleDateString() : "—"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Monthly Rent</p>
          <p className="font-medium">{tenant.units ? "KSh " + Number(tenant.units.base_rent).toLocaleString() : "—"}</p>
        </div>
      </div>
    </div>

    <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-8">
      <div className="px-6 py-5 border-b"><h3 className="text-xl font-semibold">Invoice History</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50"><tr><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Period</th><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Amount</th><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th></tr></thead>
          <tbody>
            {invoices.length === 0 ? (<tr><td colSpan={3} className="px-6 py-10 text-center text-gray-500">No invoices yet.</td></tr>) : (
              invoices.map((inv) => (<tr key={inv.id} className="border-t"><td className="px-6 py-4">{inv.billing_period}</td><td className="px-6 py-4">KSh {Number(inv.total_due).toLocaleString()}</td><td className="px-6 py-4 capitalize">{inv.status.replace("_", " ")}</td></tr>))
            )}
          </tbody>
        </table>
      </div>
    </div>

    <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-8">
      <div className="px-6 py-5 border-b"><h3 className="text-xl font-semibold">Maintenance History</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50"><tr><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Issue</th><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Urgency</th><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th></tr></thead>
          <tbody>
            {maintenance.length === 0 ? (<tr><td colSpan={3} className="px-6 py-10 text-center text-gray-500">No maintenance requests.</td></tr>) : (
              maintenance.map((m) => (<tr key={m.id} className="border-t"><td className="px-6 py-4">{m.title}</td><td className="px-6 py-4 capitalize">{m.urgency}</td><td className="px-6 py-4 capitalize">{m.status.replace("_", " ")}</td></tr>))
            )}
          </tbody>
        </table>
      </div>
    </div>

    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b"><h3 className="text-xl font-semibold">Complaints</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50"><tr><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Complaint</th><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th></tr></thead>
          <tbody>
            {complaints.length === 0 ? (<tr><td colSpan={2} className="px-6 py-10 text-center text-gray-500">No complaints.</td></tr>) : (
              complaints.map((c) => (<tr key={c.id} className="border-t"><td className="px-6 py-4">{c.description}</td><td className="px-6 py-4 capitalize">{c.status.replace("_", " ")}</td></tr>))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <footer className="border-t bg-white mt-10">
    <div className="max-w-5xl mx-auto px-6 py-6 text-sm text-gray-500">© 2026 Managika Homes. Property management made simple.</div>
  </footer>
</main>

);
}