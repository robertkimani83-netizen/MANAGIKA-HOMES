"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Visual "how far along is this repair" tracker, matching the one on
// the landlord's Maintenance page - submitted -> assigned -> in
// progress -> completed - so a tenant doesn't have to keep asking
// "what happened to my request?"
const STAGES = [
{ key: "submitted", label: "Received", dot: "bg-red-500" },
{ key: "assigned", label: "Assigned", dot: "bg-amber-500" },
{ key: "in_progress", label: "In Progress", dot: "bg-blue-500" },
{ key: "completed", label: "Completed", dot: "bg-green-500" },
];

function StageTracker({ status }: { status: string }) {
const currentIndex = STAGES.findIndex((s) => s.key === status);
return (
  <div className="flex items-center gap-1">
    {STAGES.map((stage, i) => (
      <span key={stage.key} className={"h-2.5 w-2.5 rounded-full " + (i <= currentIndex ? stage.dot : "bg-gray-200")} title={stage.label} />
    ))}
  </div>
);
}

function currentPeriod() {
const d = new Date();
const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
return names[d.getMonth()] + " " + d.getFullYear();
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
const [reportingPayment, setReportingPayment] = useState(false);
const [paymentInfo, setPaymentInfo] = useState<any>({ mpesa_enabled: false, bank_enabled: false, has_pending_claim: false });
const [authToken, setAuthToken] = useState("");
const [lastPayment, setLastPayment] = useState<{ amount: number; paidAt: string } | null>(null);
const [paymentHistory, setPaymentHistory] = useState<{ id: string; amount: number; method: string; reference: string | null; paidAt: string; period: string }[]>([]);
const [notices, setNotices] = useState<any[]>([]);
const [myDocuments, setMyDocuments] = useState<any[]>([]);

useEffect(() => {
async function init() {
const { data } = await supabase.auth.getUser();
if (!data.user || (!data.user.email && !data.user.phone)) { router.push("/tenant/login"); return; }

  // No client-side email/phone filter here on purpose - RLS on the tenants
  // table already scopes this to exactly the caller's own row, matching by
  // whichever of email or phone their account was authenticated with. That
  // lets phone-only tenants (no email on file) load their dashboard too.
  const { data: tenantRow } = await supabase.from("tenants").select("id, full_name, phone_number, email, unit_id, landlord_id, units(unit_number, base_rent, properties(property_name))").maybeSingle();
  if (!tenantRow) { router.push("/tenant/login"); return; }
  setTenant(tenantRow);

  // Notices posted by this tenant's own landlord - RLS on the announcements
  // table also enforces this (a tenant can only see their own landlord's
  // posts), this filter is just the normal query shape.
  if (tenantRow.landlord_id) {
    const { data: noticeRows } = await supabase.from("announcements").select("id, title, body, category, created_at").eq("landlord_id", tenantRow.landlord_id).order("created_at", { ascending: false }).limit(5);
    setNotices(noticeRows || []);
  }

  const { data: invoiceRows } = await supabase.from("invoices").select("id, billing_period, total_due, status, due_date").eq("tenant_id", tenantRow.id).order("due_date", { ascending: false });
  setInvoices(invoiceRows || []);

  const { data: maintenanceRows } = await supabase.from("maintenance_requests").select("id, category, title, description, urgency, status, created_at").eq("tenant_id", tenantRow.id).order("created_at", { ascending: false });
  setMaintenance(maintenanceRows || []);

  const { data: complaintRows } = await supabase.from("complaints").select("id, description, status, created_at").eq("tenant_id", tenantRow.id).order("created_at", { ascending: false });
  setComplaints(complaintRows || []);

  // Most recent payment, for the "My Home" summary card.
  const { data: recentPayment } = await supabase
    .from("payments")
    .select("amount_paid, paid_at, invoices!inner(tenant_id)")
    .eq("invoices.tenant_id", tenantRow.id)
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recentPayment) {
    setLastPayment({ amount: Number((recentPayment as any).amount_paid) || 0, paidAt: (recentPayment as any).paid_at });
  }

  // Full payment history - a lightweight stand-in for downloadable
  // receipts: every past payment, in one place, instead of only the
  // current period's invoice status.
  const { data: paymentRows } = await supabase
    .from("payments")
    .select("id, amount_paid, payment_method, transaction_reference, paid_at, invoices!inner(tenant_id, billing_period)")
    .eq("invoices.tenant_id", tenantRow.id)
    .order("paid_at", { ascending: false });
  if (paymentRows) {
    setPaymentHistory(
      (paymentRows as any[]).map((p) => ({
        id: p.id,
        amount: Number(p.amount_paid) || 0,
        method: p.payment_method || "—",
        reference: p.transaction_reference,
        paidAt: p.paid_at,
        period: p.invoices?.billing_period || "—",
      }))
    );
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token || "";
  setAuthToken(token);

  // One-time (no-op after the first time): links this tenant's account to
  // the phone number on file so they can also sign in with their phone
  // number, not just email. Fire-and-forget - never blocks the dashboard.
  fetch("/api/tenants/link-phone", { method: "POST", headers: { Authorization: "Bearer " + token } }).catch(() => {});

  try {
    const infoRes = await fetch("/api/tenant-payment-info", { headers: { Authorization: "Bearer " + token } });
    const info = await infoRes.json();
    setPaymentInfo(info);
  } catch (e) {
    setPaymentInfo({ mpesa_enabled: false, bank_enabled: false });
  }

  try {
    const docsRes = await fetch("/api/documents", { headers: { Authorization: "Bearer " + token } });
    const docsResult = await docsRes.json();
    if (docsRes.ok) setMyDocuments(docsResult.documents || []);
  } catch (e) {
    setMyDocuments([]);
  }

  setLoading(false);
}
init();

}, [router]);

async function viewMyDocument(id: string) {
const { data: sessionData } = await supabase.auth.getSession();
const token = sessionData.session?.access_token || "";
const res = await fetch("/api/documents/" + id + "/url", { headers: { Authorization: "Bearer " + token } });
const result = await res.json();
if (!res.ok) { alert("Could not open document: " + (result.error || "unknown error")); return; }
window.open(result.url, "_blank");
}

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
if (!authToken) { alert("Your session expired - please refresh and log in again."); return; }
setPayingBalance(true);
try {
const res = await fetch("/api/mpesa-stk-push", {
method: "POST",
headers: { "Content-Type": "application/json", Authorization: "Bearer " + authToken },
body: JSON.stringify({
invoiceId: currentInvoice ? currentInvoice.id : null,
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

async function reportPayment(method: string) {
if (!authToken) { alert("Your session expired - please refresh and log in again."); return; }
setReportingPayment(true);
try {
const res = await fetch("/api/tenants/report-payment", {
method: "POST",
headers: { "Content-Type": "application/json", Authorization: "Bearer " + authToken },
body: JSON.stringify({ method }),
});
const result = await res.json();
if (!res.ok) { alert("Could not notify your landlord: " + (result.error || "unknown error")); return; }
setPaymentInfo((prev: any) => ({ ...prev, has_pending_claim: true }));
} catch (err: any) {
alert("Error: " + err.message);
} finally {
setReportingPayment(false);
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
<a href="/download-app" className="mh-hide-in-app px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700">📲 Get App</a>
<button onClick={signOut} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700">Sign Out</button>
</div>
</div>
</header>

  <section className="max-w-5xl mx-auto px-6 py-8">
    <div className="mb-8">
      <h2 className="text-3xl font-bold text-gray-900">Welcome, {tenant.full_name}</h2>
      <p className="text-gray-500 mt-1">{tenant.units ? tenant.units.properties?.property_name + " — Unit " + tenant.units.unit_number : "No unit assigned yet"}</p>
    </div>

    {notices.length > 0 && (
      <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">📣 Notices</h3>
        <div className="divide-y">
          {notices.map((n) => (
            <div key={n.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 capitalize">{n.category}</span>
                <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleDateString()}</span>
              </div>
              <p className="font-semibold text-gray-900">{n.title}</p>
              <p className="text-gray-600 text-sm mt-1 whitespace-pre-wrap">{n.body}</p>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* "Everything about their home in one screen" - a quick-glance
        summary before the detailed tables further down. */}
    {tenant.units && (
      <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">🏠 My Home</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Unit</p>
            <p className="mt-1 font-semibold text-gray-900">{tenant.units.unit_number}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Rent</p>
            <p className="mt-1 font-semibold text-gray-900">KSh {Number(tenant.units.base_rent).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">{period} Status</p>
            <p className={"mt-1 font-semibold capitalize " + (currentInvoice?.status === "paid" ? "text-green-700" : "text-amber-700")}>
              {currentInvoice ? currentInvoice.status.replace("_", " ") : "No invoice yet"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Last Payment</p>
            <p className="mt-1 font-semibold text-gray-900">
              {lastPayment ? "KSh " + lastPayment.amount.toLocaleString() + (lastPayment.paidAt ? " · " + new Date(lastPayment.paidAt).toLocaleDateString() : "") : "None yet"}
            </p>
          </div>
        </div>
      </div>
    )}

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
            <p className="mt-1 text-xs text-gray-500">After paying, tap below to let your landlord know.</p>
            {paymentInfo.has_pending_claim ? (
              <p className="mt-2 text-xs font-semibold text-amber-600">✓ Marked as paid - waiting for your landlord to confirm.</p>
            ) : (
              <button onClick={() => reportPayment("manual_mpesa")} disabled={reportingPayment} className="mt-2 w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                {reportingPayment ? "Notifying..." : "I've Paid"}
              </button>
            )}
          </div>
        )}
        {currentInvoice?.status !== "paid" && tenant.units && paymentInfo.bank_enabled && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-left text-sm">
            <p className="font-semibold text-gray-700">Pay by bank transfer:</p>
            <p className="text-gray-600">{paymentInfo.bank_name}</p>
            <p className="text-gray-600">{paymentInfo.bank_account_name}</p>
            <p className="text-gray-600">Acc: {paymentInfo.bank_account_number}</p>
            {paymentInfo.bank_branch && <p className="text-gray-600">Branch: {paymentInfo.bank_branch}</p>}
            <p className="mt-1 text-xs text-gray-500">After transferring, tap below to let your landlord know.</p>
            {paymentInfo.has_pending_claim ? (
              <p className="mt-2 text-xs font-semibold text-amber-600">✓ Marked as paid - waiting for your landlord to confirm.</p>
            ) : (
              <button onClick={() => reportPayment("bank")} disabled={reportingPayment} className="mt-2 w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                {reportingPayment ? "Notifying..." : "I've Paid"}
              </button>
            )}
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

    <div className="bg-white rounded-xl border shadow-sm p-6 mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">📄 My Documents</h3>
      {myDocuments.length === 0 ? (
        <p className="text-gray-500 text-sm">Your landlord hasn&apos;t shared any documents with you yet.</p>
      ) : (
        <div className="divide-y">
          {myDocuments.map((d) => (
            <div key={d.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-gray-900">{d.file_name}</p>
                <p className="text-xs text-gray-500 capitalize">{d.document_type.replace("_", " ")} · {new Date(d.uploaded_at).toLocaleDateString()}</p>
              </div>
              <button onClick={() => viewMyDocument(d.id)} className="text-sm text-blue-700 hover:underline shrink-0">View</button>
            </div>
          ))}
        </div>
      )}
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
      <div className="px-6 py-5 border-b"><h3 className="text-xl font-semibold">Payment History</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50"><tr><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Date</th><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Period</th><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Amount</th><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Method</th><th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Reference</th></tr></thead>
          <tbody>
            {paymentHistory.length === 0 ? (<tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">No payments recorded yet.</td></tr>) : (
              paymentHistory.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-6 py-4">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "—"}</td>
                  <td className="px-6 py-4">{p.period}</td>
                  <td className="px-6 py-4">KSh {p.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 capitalize">{p.method}</td>
                  <td className="px-6 py-4 text-gray-500">{p.reference || "—"}</td>
                </tr>
              ))
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
              maintenance.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-6 py-4"><div className="font-medium">{m.title}</div><div className="text-sm text-gray-500">{m.description}</div></td>
                  <td className="px-6 py-4 capitalize">{m.urgency}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <StageTracker status={m.status} />
                      <span className="text-sm capitalize text-gray-600">{m.status.replace("_", " ")}</span>
                    </div>
                  </td>
                </tr>
              ))
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
