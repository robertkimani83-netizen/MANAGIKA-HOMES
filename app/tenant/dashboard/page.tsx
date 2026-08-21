"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function currentPeriod() {
const d = new Date();
const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
return names[d.getMonth()] + " " + d.getFullYear();
}

function toKenyanFormat(phone: string) {
const digits = phone.replace(/\D/g, "");
if (digits.startsWith("254")) return digits;
if (digits.startsWith("0")) return "254" + digits.slice(1);
if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
return digits;
}

export default function TenantDashboard() {
const router = useRouter();
const [loading, setLoading] = useState(true);
const [tenant, setTenant] = useState<any>(null);
const [invoices, setInvoices] = useState<any[]>([]);
const [maintenance, setMaintenance] = useState<any[]>([]);
const [complaints, setComplaints] = useState<any[]>([]);
const [showMaintForm, setShowMaintForm] = useState(false);
const [showComplaintForm, setShowComplaintForm] = useState(false);
const [category, setCategory] = useState("plumbing");
const [title, setTitle] = useState("");
const [description, setDescription] = useState("");
const [urgency, setUrgency] = useState("normal");
const [complaintText, setComplaintText] = useState("");
const [payingBalance, setPayingBalance] = useState(false);
const [paymentInfo, setPaymentInfo] = useState<any>({ mpesa_enabled: false, bank_enabled: false });

useEffect(() => {
async function init() {
const { data } = await supabase.auth.getUser();
if (!data.user || !data.user.email) { router.push("/tenant/login"); return; }

  const { data: tenantRow } = await supabase.from("tenants").select("id, full_name, phone_number, email, unit_id, units(unit_number, base_rent, properties(property_name))").eq("email", data.user.email).maybeSingle();
  if (!tenantRow) { router.push("/tenant/login"); return; }
  setTenant(tenantRow);

  const { data: invoiceRows } = await supabase.from("invoices").select("id, billing_period, total_due, status, due_date").eq("tenant_id", tenantRow.id).order("due_date", { ascending: false });
  setInvoices(invoiceRows || []);

  const { data: maintenanceRows } = await supabase.from("maintenance_requests").select("id, category, title, description, urgency, status, created_at").eq("tenant_id", tenantRow.id).order("created_at", { ascending: false });
  setMaintenance(maintenanceRows || []);

  const { data: complaintRows } = await supabase.from("complaints").select("id, description, status, created_at").eq("tenant_id", tenantRow.id).order("created_at", { ascending: false });
  setComplaints(complaintRows || []);

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token || "";
  try {
    const infoRes = await fetch("/api/tenant-payment-info", { headers: { Authorization: "Bearer " + token } });
    const info = await infoRes.json();
    setPaymentInfo(info);
  } catch (e) {
    setPaymentInfo({ mpesa_enabled: false, bank_enabled: false });
  }

  setLoading(false);
}
init();

}, [router]);

async function submitMaintenance() {
if (!tenant) return;
if (!title.trim() || !description.trim()) { alert("Please fill in the title and description."); return; }
const { error } = await supabase.from("maintenance_requests").insert({ tenant_id: tenant.id, unit_id: tenant.unit_id, category, title: title.trim(), description: description.trim(), urgency, status: "submitted" });
if (error) { alert("Error submitting request: " + error.message); return; }
setTitle(""); setDescription(""); setCategory("plumbing"); setUrgency("normal"); setShowMaintForm(false);
const { data: maintenanceRows } = await supabase.from("maintenance_requests").select("id, category, title, description, urgency, status, created_at").eq("tenant_id", tenant.id).order("created_at", { ascending: false });
setMaintenance(maintenanceRows || []);
}

async function submitComplaint() {
if (!tenant) return;
if (!complaintText.trim()) { alert("Please describe your complaint."); return; }
const { error } = await supabase.from("complaints").insert({ tenant_id: tenant.id, unit_id: tenant.unit_id, description: complaintText.trim(), status: "submitted" });
if (error) { alert("Error submitting complaint: " + error.message); return; }
setComplaintText(""); setShowComplaintForm(false);
const { data: complaintRows } = await supabase.from("complaints").select("id, description, status, created_at").eq("tenant_id", tenant.id).order("created_at", { ascending: false });
setComplaints(complaintRows || []);
}

async function payWithMpesa() {
if (!tenant || !tenant.phone_number || !tenant.units) { alert("Missing phone number or unit information."); return; }
setPayingBalance(true);
try {
const res = await fetch("/api/mpesa-stk-push", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
tenantId: tenant.id,
invoiceId: currentInvoice ? currentInvoice.id : null,
phoneNumber: toKenyanFormat(tenant.phone_number),
amount: Number(tenant.units.base_rent),
accountReference: tenant.full_name,
}),
});
const result = await res.json();
if (result.ResponseCode === "0") {
alert("Check your phone to complete the M-Pesa payment.");
} else {
alert("Payment could not be started: " + (result.errorMessage || result.error || "unknown error"));
}
} catch (err: any) {
alert("Error starting payment: " + err.message);
} finally {
setPayingBalance(false);
}
}

async function signOut() {
await supabase.auth.signOut();
router.push("/tenant/login");
}

if (loading || !tenant) {
return (<main className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500">Loading your account...</main>);
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
<div className="flex items-center gap-3">
<a href="/tenant/ai-assistant" className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700">🤖 AI Assistant</a>
<button onClick={signOut} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700">Sign Out</button>
</div>
</div>
</header>

  <section className="max-w-5xl mx-auto px-6 py-8">
    <div className="mb-8">
      <h2 className="text-3xl font-bold text-gray-900">Welcome, {tenant.full_name}</h2>
      <p className="text-gray-500 mt-1">{tenant.units ? tenant.units.properties?.property_name + " — Unit " + tenant.units.unit_number : "No unit assigned yet"}</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-gray-500">Monthly Rent</p>
        <p className="text-3xl font-bold mt-2">{tenant.units ? "KSh " + Number(tenant.units.base_rent).toLocaleString() : "—"}</p>
      </div>
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-gray-500">{period} Status</p>
        <p className="text-3xl font-bold mt-2 capitalize">{currentInvoice ? currentInvoice.status.replace("_", " ") : "No invoice yet"}</p>
        {currentInvoice?.status !== "paid" && tenant.units && paymentInfo.mpesa_enabled && (
          <button onClick={payWithMpesa} disabled={payingBalance} className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            {payingBalance ? "Starting..." : "Pay with M-Pesa"}
          </button>
        )}
        {currentInvoice?.status !== "paid" && tenant.units && paymentInfo.manual_mpesa_enabled && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-left text-sm">
            <p className="font-semibold text-gray-700">Pay via M-Pesa:</p>
            <p className="text-gray-600">{paymentInfo.manual_mpesa_type === "till" ? "Till Number" : "Phone Number"}: {paymentInfo.manual_mpesa_number}</p>
            {paymentInfo.manual_mpesa_name && <p className="text-gray-600">{paymentInfo.manual_mpesa_name}</p>}
            <p className="mt-1 text-xs text-gray-500">After paying, let your landlord know so they can mark it paid.</p>
          </div>
        )}
        {currentInvoice?.status !== "paid" && tenant.units && paymentInfo.bank_enabled && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-left text-sm">
            <p className="font-semibold text-gray-700">Pay by bank transfer:</p>
            <p className="text-gray-600">{paymentInfo.bank_name}</p>
            <p className="text-gray-600">{paymentInfo.bank_account_name}</p>
            <p className="text-gray-600">Acc: {paymentInfo.bank_account_number}</p>
            {paymentInfo.bank_branch && <p className="text-gray-600">Branch: {paymentInfo.bank_branch}</p>}
            <p className="mt-1 text-xs text-gray-500">After transferring, let your landlord know so they can mark it paid.</p>
          </div>
        )}
        {currentInvoice?.status !== "paid" && tenant.units && !paymentInfo.mpesa_enabled && !paymentInfo.manual_mpesa_enabled && !paymentInfo.bank_enabled && (
          <p className="mt-4 text-sm text-gray-500">Online payment isn't set up yet - please contact your landlord directly to pay rent.</p>
        )}
      </div>
      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <p className="text-sm text-gray-500">Open Maintenance</p>
        <p className="text-3xl font-bold mt-2">{maintenance.filter((m) => m.status !== "completed").length}</p>
      </div>
    </div>

    <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-8">
      <div className="px-6 py-5 border-b"><h3 className="text-xl font-semibold">My Invoices</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50"><tr><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Period</th><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Amount</th><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Due Date</th><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th></tr></thead>
          <tbody>
            {invoices.length === 0 ? (<tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">No invoices yet.</td></tr>) : (
              invoices.map((inv) => (<tr key={inv.id} className="border-t"><td className="px-6 py-4">{inv.billing_period}</td><td className="px-6 py-4">KSh {Number(inv.total_due).toLocaleString()}</td><td className="px-6 py-4">{inv.due_date}</td><td className="px-6 py-4 capitalize">{inv.status.replace("_", " ")}</td></tr>))
            )}
          </tbody>
        </table>
      </div>
    </div>

    <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-8">
      <div className="px-6 py-5 border-b flex items-center justify-between">
        <h3 className="text-xl font-semibold">My Maintenance Requests</h3>
        <button onClick={() => setShowMaintForm(true)} className="px-4 py-2 rounded-lg bg-black text-white text-sm font-medium">+ New Request</button>
      </div>

      {showMaintForm && (
        <div className="p-6 border-b bg-gray-50">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black">
                <option value="plumbing">Plumbing</option><option value="electrical">Electrical</option><option value="structural">Structural</option><option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Urgency</label>
              <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black">
                <option value="normal">Normal</option><option value="urgent">Urgent</option>
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
            <button onClick={() => setShowMaintForm(false)} className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50"><tr><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Issue</th><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Urgency</th><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th></tr></thead>
          <tbody>
            {maintenance.length === 0 ? (<tr><td colSpan={3} className="px-6 py-10 text-center text-gray-500">No maintenance requests yet.</td></tr>) : (
              maintenance.map((m) => (<tr key={m.id} className="border-t"><td className="px-6 py-4"><div className="font-medium">{m.title}</div><div className="text-sm text-gray-500">{m.description}</div></td><td className="px-6 py-4 capitalize">{m.urgency}</td><td className="px-6 py-4 capitalize">{m.status.replace("_", " ")}</td></tr>))
            )}
          </tbody>
        </table>
      </div>
    </div>

    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b flex items-center justify-between">
        <h3 className="text-xl font-semibold">My Complaints</h3>
        <button onClick={() => setShowComplaintForm(true)} className="px-4 py-2 rounded-lg bg-black text-white text-sm font-medium">+ New Complaint</button>
      </div>

      {showComplaintForm && (
        <div className="p-6 border-b bg-gray-50">
          <label className="mb-2 block text-sm font-medium text-gray-700">Describe your complaint</label>
          <textarea value={complaintText} onChange={(e) => setComplaintText(e.target.value)} rows={3} placeholder="e.g. Noisy neighbor at night" className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black" />
          <div className="mt-4 flex gap-3">
            <button onClick={submitComplaint} className="rounded-lg bg-black px-5 py-3 font-medium text-white">Submit Complaint</button>
            <button onClick={() => setShowComplaintForm(false)} className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50"><tr><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Complaint</th><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Status</th></tr></thead>
          <tbody>
            {complaints.length === 0 ? (<tr><td colSpan={2} className="px-6 py-10 text-center text-gray-500">No complaints yet.</td></tr>) : (
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
