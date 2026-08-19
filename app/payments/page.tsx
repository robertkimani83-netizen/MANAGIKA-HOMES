"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Tenant = {
id: string;
full_name: string;
unit_id: string | null;
units: { id: string; unit_number: string; base_rent: number; properties: { property_name: string } | null } | null;
};

type Payment = {
id: string;
amount_paid: number;
payment_method: string;
transaction_reference: string | null;
paid_at: string;
invoices: {
billing_period: string;
status: string;
tenants: { full_name: string } | null;
units: { unit_number: string } | null;
} | null;
};

function currentPeriod() {
const d = new Date();
const names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
return names[d.getMonth()] + " " + d.getFullYear();
}

export default function PaymentsPage() {
const [tenants, setTenants] = useState<Tenant[]>([]);
const [payments, setPayments] = useState<Payment[]>([]);
const [loading, setLoading] = useState(true);
const [showForm, setShowForm] = useState(false);

const [tenantId, setTenantId] = useState("");
const [amount, setAmount] = useState("");
const [method, setMethod] = useState("mpesa");
const [reference, setReference] = useState("");

async function loadTenants() {
const { data } = await supabase
.from("tenants")
.select("id, full_name, unit_id, units(id, unit_number, base_rent, properties(property_name))")
.eq("status", "active")
.order("full_name", { ascending: true });
if (data) setTenants(data as unknown as Tenant[]);
}

async function loadPayments() {
setLoading(true);
const { data, error } = await supabase
.from("payments")
.select("id, amount_paid, payment_method, transaction_reference, paid_at, invoices(billing_period, status, tenants(full_name), units(unit_number))")
.order("paid_at", { ascending: false });
if (!error && data) setPayments(data as unknown as Payment[]);
setLoading(false);
}

useEffect(() => {
loadTenants();
loadPayments();
}, []);

async function recordPayment() {
if (!tenantId) {
alert("Please select a tenant.");
return;
}
const amt = Number(amount);
if (!Number.isFinite(amt) || amt <= 0) {
alert("Please enter a valid amount.");
return;
}

const tenant = tenants.find((t) => t.id === tenantId);
if (!tenant || !tenant.units) {
  alert("This tenant has no unit assigned yet.");
  return;
}

const period = currentPeriod();
const rent = Number(tenant.units.base_rent) || 0;

const { data: existingInvoice } = await supabase
  .from("invoices")
  .select("id, total_due")
  .eq("tenant_id", tenantId)
  .eq("billing_period", period)
  .maybeSingle();

let invoiceId = existingInvoice?.id;
let totalDue = existingInvoice ? Number(existingInvoice.total_due) : rent;

if (!invoiceId) {
  const dueDate = new Date();
  const { data: newInvoice, error: invError } = await supabase
    .from("invoices")
    .insert({
      invoice_number: "INV-" + Date.now(),
      tenant_id: tenantId,
      unit_id: tenant.unit_id,
      billing_period: period,
      rent_amount: rent,
      total_due: rent,
      status: "unpaid",
      due_date: dueDate.toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (invError || !newInvoice) {
    alert("Error creating invoice: " + (invError?.message || "unknown error"));
    return;
  }
  invoiceId = newInvoice.id;
  totalDue = rent;
}

const { error: payError } = await supabase.from("payments").insert({
  invoice_id: invoiceId,
  amount_paid: amt,
  payment_method: method,
  transaction_reference: reference.trim() || null,
});

if (payError) {
  alert("Error recording payment: " + payError.message);
  return;
}

const newStatus = amt >= totalDue ? "paid" : "partially_paid";
await supabase.from("invoices").update({ status: newStatus }).eq("id", invoiceId);

setTenantId("");
setAmount("");
setReference("");
setShowForm(false);
loadPayments();

}

const period = currentPeriod();
const rentExpected = tenants.reduce((sum, t) => sum + (Number(t.units?.base_rent) || 0), 0);
const rentCollected = payments
.filter((p) => p.invoices?.billing_period === period)
.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
const outstanding = rentExpected - rentCollected;

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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Rent & Payments</h2>
        <p className="text-gray-500 mt-1">Track rent, payments, invoices and outstanding balances — {period}.</p>
      </div>
      <button onClick={() => setShowForm(true)} className="px-5 py-3 rounded-lg bg-black text-white font-medium">+ Record Payment</button>
    </div>

    {showForm && (
      <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-xl font-bold text-gray-900">Record Payment — {period}</h3>
        {tenants.length === 0 ? (
          <p className="text-gray-500">Add a tenant with a unit assigned first.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Tenant</label>
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black">
                <option value="">Select tenant</option>
                {tenants.filter((t) => t.units).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} — {t.units?.unit_number} (KSh {Number(t.units?.base_rent).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Amount Paid (KSh)</label>
              <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 10000" className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black">
                <option value="mpesa">M-Pesa</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Reference (optional)</label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. M-Pesa code" className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black" />
            </div>
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <button onClick={recordPayment} className="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800">Save Payment</button>
          <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    )}

    <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-gray-500">Rent Expected</p>
        <p className="text-3xl font-bold mt-2">KSh {rentExpected.toLocaleString()}</p>
      </div>
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-gray-500">Rent Collected</p>
        <p className="text-3xl font-bold mt-2">KSh {rentCollected.toLocaleString()}</p>
      </div>
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-gray-500">Outstanding</p>
        <p className="text-3xl font-bold mt-2">KSh {outstanding.toLocaleString()}</p>
      </div>
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-gray-500">Payments Logged</p>
        <p className="text-3xl font-bold mt-2">{payments.length}</p>
      </div>
    </div>

    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b">
        <h3 className="text-xl font-semibold">Recent Payments</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Tenant</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Unit</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Amount</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Period</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Method</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">Loading payments...</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">No payments have been recorded yet.</td></tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-6 py-4">{p.invoices?.tenants?.full_name || "—"}</td>
                  <td className="px-6 py-4">{p.invoices?.units?.unit_number || "—"}</td>
                  <td className="px-6 py-4">KSh {Number(p.amount_paid).toLocaleString()}</td>
                  <td className="px-6 py-4">{p.invoices?.billing_period || "—"}</td>
                  <td className="px-6 py-4 capitalize">{p.payment_method.replace("_", " ")}</td>
                  <td className="px-6 py-4 capitalize">{p.invoices?.status.replace("_", " ") || "—"}</td>
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