"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Invoice = {
id: string;
billing_period: string;
total_due: number;
status: string;
due_date: string;
};

type Maintenance = {
id: string;
category: string;
title: string;
description: string;
urgency: string;
status: string;
created_at: string;
};

type Tenant = {
id: string;
full_name: string;
phone_number: string;
email: string | null;
unit_id: string | null;
units: {
unit_number: string;
base_rent: number;
properties: { property_name: string } | null;
} | null;
};

function currentPeriod() {
const d = new Date();
const names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
return names[d.getMonth()] + " " + d.getFullYear();
}

export default function TenantDashboard() {
const router = useRouter();
const [loading, setLoading] = useState(true);
const [tenant, setTenant] = useState<Tenant | null>(null);
const [invoices, setInvoices] = useState<Invoice[]>([]);
const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
const [showForm, setShowForm] = useState(false);
const [category, setCategory] = useState("plumbing");
const [title, setTitle] = useState("");
const [description, setDescription] = useState("");
const [urgency, setUrgency] = useState("normal");

useEffect(() => {
async function init() {
const { data } = await supabase.auth.getUser();
if (!data.user || !data.user.email) {
router.push("/tenant/login");
return;
}

  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("id, full_name, phone_number, email, unit_id, units(unit_number, base_rent, properties(property_name))")
    .eq("email", data.user.email)
    .maybeSingle();

  if (!tenantRow) {
    router.push("/tenant/login");
    return;
  }

  setTenant(tenantRow as unknown as Tenant);

  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select("id, billing_period, total_due, status, due_date")
    .eq("tenant_id", tenantRow.id)
    .order("due_date", { ascending: false });

  setInvoices((invoiceRows || []) as Invoice[]);

  const { data: maintenanceRows } = await supabase
    .from("maintenance_requests")
    .select("id, category, title, description, urgency, status, created_at")
    .eq("tenant_id", tenantRow.id)
    .order("created_at", { ascending: false });

  setMaintenance((maintenanceRows || []) as Maintenance[]);
  setLoading(false);
}
init();

}, [router]);

async function submitMaintenance() {
if (!tenant) return;
if (!title.trim() || !description.trim()) {
alert("Please fill in the title and description.");
return;
}
const { error } = await supabase.from("maintenance_requests").insert({
tenant_id: tenant.id,
unit_id: tenant.unit_id,
category,
title: title.trim(),
description: description.trim(),
urgency,
status: "submitted",
});
if (error) {
alert("Error submitting request: " + error.message);
return;
}
setTitle("");
setDescription("");
setCategory("plumbing");
setUrgency("normal");
setShowForm(false);

const { data: maintenanceRows } = await supabase
  .from("maintenance_requests")
  .select("id, category, title, description, urgency, status, created_at")
  .eq("tenant_id", tenant.id)
  .order("created_at", { ascending: false });
setMaintenance((maintenanceRows || []) as Maintenance[]);

}

async function signOut() {
await supabase.auth.signOut();
router.push("/tenant/login");
}

if (loading || !tenant) {
return (
<main className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500">
Loading your account...
</main>
);
}

const period = currentPeriod();
const currentInvoice = invoices.find((inv) => inv.billing_period === period);

return (
<main className="min-h-screen bg-gray-100">
<header className="bg-white border-b">
<div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
<div>
<h1 className="text-2xl font-bold text-gray-900">MANAGIKA HOMES</h1>
<p className="text-sm text-gray-500">Tenant Portal</p>
</div>
<button onClick={signOut} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700">Sign Out</button>
</div>
</header>

  <section className="max-w-5xl mx-auto px-6 py-8">
    <div className="mb-8">
      <h2 className="text-3xl font-bold text-gray-900">Welcome, {tenant.full_name}</h2>
      <p className="text-gray-500 mt-1">
        {tenant.units ? tenant.units.properties?.property_name + " — Unit " + tenant.units.unit_number : "No unit assigned yet"}
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-gray-500">Monthly Rent</p>
        <p className="text-3xl font-bold mt-2">{tenant.units ? "KSh " + Number(tenant.units.base_rent).toLocaleString() : "—"}</p>
      </div>
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-gray-500">{period} Status</p>
        <p className="text-3xl font-bold mt-2 capitalize">{currentInvoice ? currentInvoice.status.replace("_", " ") : "No invoice yet"}</p>
      </div>
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-gray-500">Open Maintenance</p>
        <p className="text-3xl font-bold mt-2">{maintenance.filter((m) => m.status !== "completed").length}</p>
      </div>
    </div>

    <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-8">
      <div className="px-6 py-5 border-b">
        <h3 className="text-xl font-semibold">My Invoices</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Period</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Amount</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Due Date</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">No invoices yet.</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="border-t">
                  <td className="px-6 py-4">{inv.billing_period}</td>
                  <td className="px-6 py-4">KSh {Number(inv.total_due).toLocaleString()}</td>
                  <td className="px-6 py-4">{inv.due_date}</td>
                  <td className="px-6 py-4 capitalize">{inv.status.replace("_", " ")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>

    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b flex items-center justify-between">
        <h3 className="text-xl font-semibold">My Maintenance Requests</h3>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg bg-black text-white text-sm font-medium">+ New Request</button>
      </div>

      {showForm && (
        <div className="p-6 border-b bg-gray-50">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black">
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="structural">Structural</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Urgency</label>
              <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black">
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Short Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kitchen sink leaking" className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Description</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue" className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black" />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={submitMaintenance} className="rounded-lg bg-black px-5 py-3 font-medium text-white">Submit Request</button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Issue</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Urgency</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {maintenance.length === 0 ? (
              <tr><td colSpan={3} className="px-6 py-10 text-center text-gray-500">No maintenance requests yet.</td></tr>
            ) : (
              maintenance.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-6 py-4">
                    <div className="font-medium">{m.title}</div>
                    <div className="text-sm text-gray-500">{m.description}</div>
                  </td>
                  <td className="px-6 py-4 capitalize">{m.urgency}</td>
                  <td className="px-6 py-4 capitalize">{m.status.replace("_", " ")}</td>
                </tr>
              ))
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