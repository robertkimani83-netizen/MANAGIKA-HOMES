"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function currentPeriod() {
const d = new Date();
const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
return names[d.getMonth()] + " " + d.getFullYear();
}

type MaintenanceRequest = {
id: string;
status: string;
urgency: string;
};

export default function LandlordDashboard() {
const [propertyCount, setPropertyCount] = useState(0);
const [unitCount, setUnitCount] = useState(0);
const [tenantCount, setTenantCount] = useState(0);
const [outstanding, setOutstanding] = useState(0);
const [maintenanceCount, setMaintenanceCount] = useState(0);
const [urgentMaintenance, setUrgentMaintenance] = useState(0);
const [complaintCount, setComplaintCount] = useState(0);
const [loading, setLoading] = useState(true);

useEffect(() => {
async function loadStats() {
setLoading(true);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { window.location.href = "/landlord/login"; return; }

  const landlordId = user.id;

  const { data: landlordProperties } = await supabase.from("properties").select("id").eq("landlord_id", landlordId);
  const propertyIds = (landlordProperties || []).map((p) => p.id);

  let landlordUnits: { id: string; base_rent: number; status: string }[] = [];
  if (propertyIds.length > 0) {
    const { data: units } = await supabase.from("units").select("id, base_rent, status").in("property_id", propertyIds);
    landlordUnits = units || [];
  }
  const unitIds = landlordUnits.map((u) => u.id);

  const { count: tenantCountResult } = await supabase.from("tenants").select("id", { count: "exact", head: true }).eq("landlord_id", landlordId).eq("status", "active");

  const rentExpected = landlordUnits.filter((u) => u.status === "occupied").reduce((sum, u) => sum + (Number(u.base_rent) || 0), 0);

  const period = currentPeriod();

  let collected = 0;
  const { data: tenantsForPeriod } = await supabase.from("tenants").select("id").eq("landlord_id", landlordId);
  const tenantIds = (tenantsForPeriod || []).map((t) => t.id);

  if (tenantIds.length > 0) {
    const { data: invoicesThisPeriod } = await supabase.from("invoices").select("id").in("tenant_id", tenantIds).eq("billing_period", period);
    const invoiceIds = (invoicesThisPeriod || []).map((i) => i.id);
    if (invoiceIds.length > 0) {
      const { data: paymentsThisPeriod } = await supabase.from("payments").select("amount_paid").in("invoice_id", invoiceIds);
      collected = (paymentsThisPeriod || []).reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
    }
  }

  let openRequestsCount = 0;
  let urgentRequestsCount = 0;
  let openComplaintsCount = 0;
  if (unitIds.length > 0) {
    const { data: maintenanceRequests } = await supabase.from("maintenance_requests").select("id, status, urgency").in("unit_id", unitIds);
    const requests = (maintenanceRequests || []) as MaintenanceRequest[];
    const openRequests = requests.filter((r) => r.status !== "completed");
    openRequestsCount = openRequests.length;
    urgentRequestsCount = openRequests.filter((r) => r.urgency === "urgent").length;

    const { data: complaintRows } = await supabase.from("complaints").select("id, status").in("unit_id", unitIds);
    openComplaintsCount = (complaintRows || []).filter((c: any) => c.status !== "resolved").length;
  }

  setPropertyCount(propertyIds.length);
  setUnitCount(landlordUnits.length);
  setTenantCount(tenantCountResult || 0);
  setOutstanding(Math.max(rentExpected - collected, 0));
  setMaintenanceCount(openRequestsCount);
  setUrgentMaintenance(urgentRequestsCount);
  setComplaintCount(openComplaintsCount);

  setLoading(false);
}

loadStats();

}, []);

const formatMoney = (amount: number) => "KSh " + amount.toLocaleString();

const steps = [
{ number: "①", icon: "🏠", title: "Properties", description: "Add and manage your buildings and apartments.", label: "Properties", value: propertyCount, button: "Manage Properties", href: "/properties" },
{ number: "②", icon: "🚪", title: "Units", description: "Add rental units inside your properties.", label: "Total Units", value: unitCount, button: "Manage Units", href: "/units" },
{ number: "③", icon: "👥", title: "Tenants", description: "Add tenants and assign them to units.", label: "Active Tenants", value: tenantCount, button: "Manage Tenants", href: "/tenants" },
{ number: "④", icon: "💰", title: "Payments", description: "Record rent and track outstanding payments.", label: "Outstanding Rent", value: outstanding, button: "View Payments", href: "/payments" },
{ number: "⑤", icon: "🔧", title: "Maintenance", description: "Record and track maintenance requests.", label: "Open Requests", value: maintenanceCount, button: "View Maintenance", href: "/maintenance" },
];

return (
<main className="min-h-screen bg-slate-100 text-slate-900">
<header className="city-skyline-header border-b">
<div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
<div>
<h1 className="text-2xl font-bold tracking-tight">MANAGIKA HOMES</h1>
<p className="text-sm text-slate-500">Property Management Made Simple</p>
</div>
<a href="/landlord/login" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign Out</a>
</div>
</header>

  <section className="city-skyline-hero border-b">
    <div className="mx-auto max-w-7xl px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-slate-300">Landlord Portal</p>
      <h2 className="mt-2 text-3xl font-bold md:text-4xl">Dashboard</h2>
      <p className="mt-3 max-w-2xl text-slate-300">Follow the steps from left to right to manage your property.</p>
    </div>
  </section>

  <section className="mx-auto max-w-7xl px-6 py-8">
    <div className="mb-8">
      <div className="flex items-center gap-2 overflow-x-auto pb-4">
        {steps.map((step, index) => (
          <div key={step.number} className="flex min-w-[250px] flex-1 items-center">
            <div className={`w-full rounded-2xl border ${step.title === "Properties" ? "border-blue-200" : step.title === "Units" ? "border-purple-200" : step.title === "Tenants" ? "border-emerald-200" : step.title === "Payments" ? "border-amber-200" : "border-rose-200"} bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md`}>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-2xl font-bold text-slate-400">{step.number}</span>
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl ${step.title === "Properties" ? "bg-blue-100" : step.title === "Units" ? "bg-purple-100" : step.title === "Tenants" ? "bg-emerald-100" : step.title === "Payments" ? "bg-amber-100" : "bg-rose-100"}`}>{step.icon}</span>
              </div>
              <h3 className="text-xl font-bold">{step.title}</h3>
              <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-500">{step.description}</p>
              <div className={`mt-5 rounded-xl p-4 ${step.title === "Properties" ? "bg-blue-50" : step.title === "Units" ? "bg-purple-50" : step.title === "Tenants" ? "bg-emerald-50" : step.title === "Payments" ? "bg-amber-50" : "bg-rose-50"}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{step.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {loading ? "—" : step.title === "Payments" ? formatMoney(step.value) : step.title === "Maintenance" && urgentMaintenance > 0 ? `${step.value} (${urgentMaintenance} urgent)` : step.value}
                </p>
              </div>
              <a href={step.href} className={`mt-5 flex items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-white transition ${step.title === "Properties" ? "bg-blue-600 hover:bg-blue-700" : step.title === "Units" ? "bg-purple-600 hover:bg-purple-700" : step.title === "Tenants" ? "bg-emerald-600 hover:bg-emerald-700" : step.title === "Payments" ? "bg-amber-600 hover:bg-amber-700" : "bg-rose-600 hover:bg-rose-700"}`}>{step.button}</a>
            </div>
            {index < steps.length - 1 && (<div className="hidden px-2 text-2xl font-bold text-slate-400 xl:block">→</div>)}
          </div>
        ))}
      </div>
    </div>

    <div className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Properties</p>
        <p className="mt-2 text-3xl font-bold">{loading ? "—" : propertyCount}</p>
        <p className="mt-1 text-sm text-slate-400">Buildings and properties</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Units</p>
        <p className="mt-2 text-3xl font-bold">{loading ? "—" : unitCount}</p>
        <p className="mt-1 text-sm text-slate-400">Total rental units</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Active Tenants</p>
        <p className="mt-2 text-3xl font-bold">{loading ? "—" : tenantCount}</p>
        <p className="mt-1 text-sm text-slate-400">Currently active tenants</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Outstanding Rent</p>
        <p className="mt-2 text-3xl font-bold">{loading ? "—" : formatMoney(outstanding)}</p>
        <p className="mt-1 text-sm text-slate-400">This month, currently unpaid</p>
      </div>
    </div>

    {!loading && maintenanceCount > 0 && (
      <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-amber-900">Maintenance requires attention</p>
            <p className="mt-1 text-sm text-amber-800">
              You have {maintenanceCount} open maintenance {maintenanceCount === 1 ? "request" : "requests"}
              {urgentMaintenance > 0 && `, including ${urgentMaintenance} urgent ${urgentMaintenance === 1 ? "request" : "requests"}`}.
            </p>
          </div>
          <a href="/maintenance" className="rounded-lg bg-amber-900 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-amber-800">Review Maintenance</a>
        </div>
      </div>
    )}

    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-bold">Quick Navigation</h3>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-8">
        <a href="/properties" className="rounded-xl border border-slate-200 px-4 py-4 text-center font-semibold hover:bg-slate-50">🏠 Properties</a>
        <a href="/units" className="rounded-xl border border-slate-200 px-4 py-4 text-center font-semibold hover:bg-slate-50">🚪 Units</a>
        <a href="/tenants" className="rounded-xl border border-slate-200 px-4 py-4 text-center font-semibold hover:bg-slate-50">👥 Tenants</a>
        <a href="/payments" className="rounded-xl border border-slate-200 px-4 py-4 text-center font-semibold hover:bg-slate-50">💰 Payments</a>
        <a href="/maintenance" className="rounded-xl border border-slate-200 px-4 py-4 text-center font-semibold hover:bg-slate-50">🔧 Maintenance</a>
        <a href="/complaints" className="rounded-xl border border-slate-200 px-4 py-4 text-center font-semibold hover:bg-slate-50">📢 Complaints{complaintCount > 0 ? " (" + complaintCount + ")" : ""}</a>
        <a href="/ai-assistant" className="rounded-xl border border-slate-200 px-4 py-4 text-center font-semibold hover:bg-slate-50">🤖 AI Assistant</a>
        <a href="/payment-settings" className="rounded-xl border border-slate-200 px-4 py-4 text-center font-semibold hover:bg-slate-50">💳 Payment Settings</a>
      </div>
    </div>
  </section>

  <footer className="mt-10 border-t bg-white">
    <div className="mx-auto max-w-7xl px-6 py-6 text-center text-sm text-slate-500">© 2026 Managika Homes. Property management made simple.</div>
  </footer>
</main>

);
}
