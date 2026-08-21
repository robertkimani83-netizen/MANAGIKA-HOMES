"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Tenant = {
id: string;
full_name: string;
unit_id: string | null;
phone_number: string | null;
units: { id: string; unit_number: string; base_rent: number; properties: { property_name: string } | null } | null;
};

type Payment = {
id: string;
amount_paid: number;
payment_method: string;
transaction_reference: string | null;
paid_at: string;
invoices: { id: string; billing_period: string; total_due: number; status: string; tenants: { full_name: string } | null; units: { unit_number: string } | null } | null;
};

type TenantSummary = { tenant: Tenant; expected: number; paid: number; balance: number; status: string };

function currentPeriod() {
const d = new Date();
const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
return names[d.getMonth()] + " " + d.getFullYear();
}

function toKenyanFormat(phone: string) {
const digits = phone.replace(/\D/g, "");
if (digits.startsWith("254")) return "+" + digits;
if (digits.startsWith("0")) return "+254" + digits.slice(1);
if (digits.startsWith("7") || digits.startsWith("1")) return "+254" + digits;
return "+" + digits;
}

export default function PaymentsPage() {
const router = useRouter();
const [landlordId, setLandlordId] = useState<string | null>(null);
const [tenants, setTenants] = useState<Tenant[]>([]);
const [payments, setPayments] = useState<Payment[]>([]);
const [loading, setLoading] = useState(true);
const [showForm, setShowForm] = useState(false);
const [tenantId, setTenantId] = useState("");
const [amount, setAmount] = useState("");
const [method, setMethod] = useState("mpesa");
const [reference, setReference] = useState("");
const [sendingId, setSendingId] = useState<string | null>(null);

const period = currentPeriod();

useEffect(() => {
async function init() {
const { data } = await supabase.auth.getUser();
if (!data.user) { router.push("/landlord/login"); return; }
setLandlordId(data.user.id);
}
init();
}, [router]);

async function loadTenants(id: string) {
const { data, error } = await supabase.from("tenants").select("id, full_name, unit_id, phone_number, units(id, unit_number, base_rent, properties(property_name))").eq("landlord_id", id).eq("status", "active").order("full_name", { ascending: true });
if (!error && data) setTenants(data as unknown as Tenant[]);
}

async function loadPayments(id: string) {
setLoading(true);
const { data, error } = await supabase.from("payments").select("id, amount_paid, payment_method, transaction_reference, paid_at, invoices!inner(id, billing_period, total_due, status, tenants!inner(full_name, landlord_id), units(unit_number))").eq("invoices.tenants.landlord_id", id).order("paid_at", { ascending: false });
if (!error && data) setPayments(data as unknown as Payment[]);
setLoading(false);
}

useEffect(() => {
if (!landlordId) return;
loadTenants(landlordId);
loadPayments(landlordId);
}, [landlordId]);

async function recordPayment() {
if (!landlordId) { alert("You must be logged in."); return; }
if (!tenantId) { alert("Please select a tenant."); return; }
const amt = Number(amount);
if (!Number.isFinite(amt) || amt <= 0) { alert("Please enter a valid amount."); return; }
const tenant = tenants.find((t) => t.id === tenantId);
if (!tenant || !tenant.units) { alert("This tenant has no unit assigned yet."); return; }
const rent = Number(tenant.units.base_rent) || 0;

const { data: existingInvoice, error: invoiceLookupError } = await supabase.from("invoices").select("id, total_due").eq("tenant_id", tenantId).eq("billing_period", period).maybeSingle();
if (invoiceLookupError) { alert("Error checking invoice: " + invoiceLookupError.message); return; }

let invoiceId = existingInvoice?.id;
let totalDue = existingInvoice ? Number(existingInvoice.total_due) : rent;

if (!invoiceId) {
  const dueDate = new Date();
  const { data: newInvoice, error: invError } = await supabase.from("invoices").insert({ invoice_number: "INV-" + Date.now(), tenant_id: tenantId, unit_id: tenant.unit_id, billing_period: period, rent_amount: rent, total_due: rent, status: "unpaid", due_date: dueDate.toISOString().slice(0, 10) }).select("id").single();
  if (invError || !newInvoice) { alert("Error creating invoice: " + (invError?.message || "unknown error")); return; }
  invoiceId = newInvoice.id;
  totalDue = rent;
}

const { error: payError } = await supabase.from("payments").insert({ invoice_id: invoiceId, amount_paid: amt, payment_method: method, transaction_reference: reference.trim() || null });
if (payError) { alert("Error recording payment: " + payError.message); return; }

const { data: invoicePayments } = await supabase.from("payments").select("amount_paid").eq("invoice_id", invoiceId);
const totalPaid = (invoicePayments || []).reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);

let newStatus = "unpaid";
if (totalPaid >= totalDue) newStatus = "paid";
else if (totalPaid > 0) newStatus = "partially_paid";

const { error: statusError } = await supabase.from("invoices").update({ status: newStatus }).eq("id", invoiceId);
if (statusError) alert("Payment saved, but invoice status could not be updated: " + statusError.message);

setTenantId(""); setAmount(""); setReference(""); setMethod("mpesa"); setShowForm(false);
loadPayments(landlordId);

}

async function sendReminder(summary: TenantSummary) {
if (!summary.tenant.phone_number) { alert("This tenant has no phone number on file."); return; }
setSendingId(summary.tenant.id);
try {
const message = "Hi " + summary.tenant.full_name + ", this is a reminder from Managika Homes that your rent balance of KSh " + summary.balance.toLocaleString() + " for " + period + " is due. Please make payment at your earliest convenience.";
const res = await fetch("/api/send-reminder", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ phoneNumber: toKenyanFormat(summary.tenant.phone_number), message: message }),
});
const result = await res.json();
if (!res.ok) { alert("Failed to send reminder: " + (result.error || "unknown error")); return; }
alert("Reminder sent to " + summary.tenant.full_name + "!");
} catch (err: any) {
alert("Error sending reminder: " + err.message);
} finally {
setSendingId(null);
}
}

const currentPayments = payments.filter((p) => p.invoices?.billing_period === period);

const tenantSummaries: TenantSummary[] = tenants.map((tenant) => {
const tenantPayments = currentPayments.filter((p) => p.invoices?.tenants?.full_name === tenant.full_name);
const expected = Number(tenant.units?.base_rent) || 0;
const paid = tenantPayments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
const balance = Math.max(expected - paid, 0);
let status = "Unpaid";
if (expected > 0 && paid >= expected) status = "Paid";
else if (paid > 0) status = "Partially Paid";
return { tenant, expected, paid, balance, status };
});

const rentExpected = tenantSummaries.reduce((sum, item) => sum + item.expected, 0);
const rentCollected = tenantSummaries.reduce((sum, item) => sum + item.paid, 0);
const outstanding = Math.max(rentExpected - rentCollected, 0);
const paidTenants = tenantSummaries.filter((item) => item.status === "Paid").length;
const unpaidTenants = tenantSummaries.filter((item) => item.status === "Unpaid").length;

function statusClasses(status: string) {
if (status === "Paid") return "bg-green-100 text-green-700";
if (status === "Partially Paid") return "bg-amber-100 text-amber-700";
return "bg-red-100 text-red-700";
}

return (
<main className="min-h-screen bg-gray-100">
<header className="border-b bg-white">
<div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
<div>
<h1 className="text-2xl font-bold text-gray-900">MANAGIKA HOMES</h1>
<p className="text-sm text-gray-500">Property Management Made Simple</p>
</div>
<a href="/landlord/dashboard" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50">Dashboard</a>
</div>
</header>

  <section className="mx-auto max-w-7xl px-6 py-8">
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Rent & Payments</h2>
        <p className="mt-1 text-gray-500">Track rent, payments, invoices and balances — {period}.</p>
      </div>
      <button onClick={() => setShowForm(true)} className="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800">+ Record Payment</button>
    </div>

    {showForm && (
      <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-xl font-bold text-gray-900">Record Payment — {period}</h3>
        {tenants.length === 0 ? (
          <p className="text-gray-500">Add an active tenant with a unit assigned first.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Tenant</label>
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black">
                <option value="">Select tenant</option>
                {tenants.filter((t) => t.units).map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.full_name} — {tenant.units?.unit_number} (KSh {Number(tenant.units?.base_rent).toLocaleString()})</option>
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
              <label className="mb-2 block text-sm font-medium text-gray-700">Reference</label>
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

    <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Rent Expected</p>
        <p className="mt-2 text-3xl font-bold">KSh {rentExpected.toLocaleString()}</p>
        <p className="mt-1 text-sm text-gray-400">{period}</p>
      </div>
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Rent Collected</p>
        <p className="mt-2 text-3xl font-bold text-green-700">KSh {rentCollected.toLocaleString()}</p>
        <p className="mt-1 text-sm text-gray-400">{paidTenants} tenant{paidTenants === 1 ? "" : "s"} fully paid</p>
      </div>
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Outstanding</p>
        <p className="mt-2 text-3xl font-bold text-red-600">KSh {outstanding.toLocaleString()}</p>
        <p className="mt-1 text-sm text-gray-400">{unpaidTenants} unpaid</p>
      </div>
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Payments Logged</p>
        <p className="mt-2 text-3xl font-bold">{payments.length}</p>
        <p className="mt-1 text-sm text-gray-400">All recorded payments</p>
      </div>
    </div>

    <div className="mb-8 overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-b px-6 py-5">
        <h3 className="text-xl font-semibold">Rent Status — {period}</h3>
        <p className="mt-1 text-sm text-gray-500">Current rent position for each active tenant.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Tenant</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Property</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Unit</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Billing Period</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Expected</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Paid</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Balance</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Reminder</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-6 py-10 text-center text-gray-500">Loading payment information...</td></tr>
            ) : tenantSummaries.length === 0 ? (
              <tr><td colSpan={9} className="px-6 py-10 text-center text-gray-500">No active tenants have been added yet.</td></tr>
            ) : (
              tenantSummaries.map((item) => (
                <tr key={item.tenant.id} className="border-t">
                  <td className="whitespace-nowrap px-6 py-4 font-medium">{item.tenant.full_name}</td>
                  <td className="whitespace-nowrap px-6 py-4">{item.tenant.units?.properties?.property_name || "—"}</td>
                  <td className="whitespace-nowrap px-6 py-4">{item.tenant.units?.unit_number || "Unassigned"}</td>
                  <td className="whitespace-nowrap px-6 py-4">{period}</td>
                  <td className="whitespace-nowrap px-6 py-4">KSh {item.expected.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-green-700">KSh {item.paid.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-6 py-4 font-medium">KSh {item.balance.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-6 py-4"><span className={"inline-flex rounded-full px-3 py-1 text-xs font-semibold " + statusClasses(item.status)}>{item.status}</span></td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {item.status !== "Paid" && (
                      <button onClick={() => sendReminder(item)} disabled={sendingId === item.tenant.id} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                        {sendingId === item.tenant.id ? "Sending..." : "Send Reminder"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>

    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-b px-6 py-5">
        <h3 className="text-xl font-semibold">Payment History</h3>
        <p className="mt-1 text-sm text-gray-500">All payments recorded for your tenants.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Tenant</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Unit</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Amount</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Period</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Method</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Reference</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Date</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-500">Loading payments...</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-500">No payments have been recorded yet.</td></tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment.id} className="border-t">
                  <td className="whitespace-nowrap px-6 py-4 font-medium">{payment.invoices?.tenants?.full_name || "—"}</td>
                  <td className="whitespace-nowrap px-6 py-4">{payment.invoices?.units?.unit_number || "—"}</td>
                  <td className="whitespace-nowrap px-6 py-4 font-medium">KSh {Number(payment.amount_paid).toLocaleString()}</td>
                  <td className="whitespace-nowrap px-6 py-4">{payment.invoices?.billing_period || "—"}</td>
                  <td className="whitespace-nowrap px-6 py-4 capitalize">{payment.payment_method.replace("_", " ")}</td>
                  <td className="whitespace-nowrap px-6 py-4">{payment.transaction_reference || "—"}</td>
                  <td className="whitespace-nowrap px-6 py-4">{new Date(payment.paid_at).toLocaleDateString()}</td>
                  <td className="whitespace-nowrap px-6 py-4"><span className={"inline-flex rounded-full px-3 py-1 text-xs font-semibold " + statusClasses(payment.invoices?.status === "paid" ? "Paid" : payment.invoices?.status === "partially_paid" ? "Partially Paid" : "Unpaid")}>{payment.invoices?.status ? payment.invoices.status.replace("_", " ") : "—"}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <footer className="mt-10 border-t bg-white">
    <div className="mx-auto max-w-7xl px-6 py-6 text-sm text-gray-500">© 2026 Managika Homes. Property management made simple.</div>
  </footer>
</main>

);
}