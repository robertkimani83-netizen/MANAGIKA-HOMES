"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { recordRentPayment, editPayment, setRentDue, deletePayment } from "@/lib/payment-allocation";
import { shiftPeriod, periodToIndex, periodStartDate } from "@/lib/period";
import { loadPeriodStatus, type PeriodStatusRow } from "@/lib/period-status";

type Tenant = {
id: string;
full_name: string;
unit_id: string | null;
phone_number: string | null;
joined_at?: string | null;
lease_start_date?: string | null;
units: { id: string; unit_number: string; base_rent: number; properties: { property_name: string } | null } | null;
};

type Payment = {
id: string;
amount_paid: number;
payment_method: string;
transaction_reference: string | null;
paid_at: string;
invoices: { id: string; billing_period: string; total_due: number; status: string; tenants: { id: string; full_name: string } | null; units: { unit_number: string } | null } | null;
};

// expected / paid / monthBalance / status are for THIS month only. Earlier
// months are kept separate in priorParts (e.g. "September 2026: 1,500") so a
// September balance is never mixed into October's figures. balance = month
// balance + earlier months, used only for the all-months Outstanding total.
type TenantSummary = { tenant: Tenant; expected: number; paid: number; monthBalance: number; balance: number; status: string; priorBalance: number; priorParts: { period: string; owed: number }[] };

// An invoice that isn't fully paid, from ANY billing period - not just the
// current month. Without this, a tenant who misses a month and then pays
// the next one normally has that old unpaid invoice quietly disappear from
// every total on this page (it's only ever matched against `period`).
type UnpaidInvoice = { id: string; billing_period: string; total_due: number; status: string; tenant_id: string };

type PaymentClaim = {
id: string;
billing_period: string | null;
amount: number | null;
method: string;
status: string;
created_at: string;
tenants: { full_name: string; phone_number: string | null; units: { unit_number: string } | null } | null;
};

// "September 2026" for the month a date falls in (landlord's clock).
function currentPeriodOf(iso: string) {
const d = new Date(iso);
const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
return names[d.getMonth()] + " " + d.getFullYear();
}

function currentPeriod() {
const d = new Date();
const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
return names[d.getMonth()] + " " + d.getFullYear();
}

export default function PaymentsPage() {
const router = useRouter();
const [landlordId, setLandlordId] = useState<string | null>(null);
const [tenants, setTenants] = useState<Tenant[]>([]);
const [payments, setPayments] = useState<Payment[]>([]);
const [loading, setLoading] = useState(true);
const [showForm, setShowForm] = useState(false);
const [tenantId, setTenantId] = useState("");
const [tenantSearch, setTenantSearch] = useState("");
const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
const [amount, setAmount] = useState("");
const [method, setMethod] = useState("mpesa");
const [reference, setReference] = useState("");
const [sendingId, setSendingId] = useState<string | null>(null);
const [claims, setClaims] = useState<PaymentClaim[]>([]);
const [loadingClaims, setLoadingClaims] = useState(true);
const [resolvingClaimId, setResolvingClaimId] = useState<string | null>(null);
const [authToken, setAuthToken] = useState("");
const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
const [savingPayment, setSavingPayment] = useState(false);
const [remindingAll, setRemindingAll] = useState(false);
// Set when any of the page's data failed to load, so we never show "everyone unpaid" as if it were true.
const [loadError, setLoadError] = useState<string | null>(null);
// null = this account has no "Unmatched bank SMS" page (the button stays hidden);
// a number = how many bank SMS still need a look.
const [unmatchedCount, setUnmatchedCount] = useState<number | null>(null);

const period = currentPeriod();

// Which month a manually recorded payment goes to. "auto" = clear the
// tenant's oldest unpaid month first (same rule as the bank SMS webhook),
// so September rent paid in October lands on September.
const [applyTo, setApplyTo] = useState<string>("auto");

// The "Not paid in full" list - defaults to LAST month, since that's the
// one a landlord chases at the start of a new month.
const [reviewPeriod, setReviewPeriod] = useState<string>(shiftPeriod(currentPeriod(), -1));
const [reviewRows, setReviewRows] = useState<PeriodStatusRow[]>([]);
const [reviewLoading, setReviewLoading] = useState(true);
const [reviewError, setReviewError] = useState<string | null>(null);
const recentPeriods = [0, -1, -2, -3, -4, -5].map((n) => shiftPeriod(period, n));

// Edit windows. editingPayment = a row of Payment History being changed;
// editingMonth = one tenant + one month opened from Rent Status or the
// Not-paid list: change what they PAID (each payment's amount) and/or what
// is due for that month, in one window.
const [editingPayment, setEditingPayment] = useState<{ payment: Payment; amount: string; method: string; reference: string; period: string } | null>(null);
type MonthEdit = {
  tenantId: string;
  unitId: string | null;
  name: string;
  unit: string;
  baseRent: number;
  period: string;
  due: string;
  originalDue: number;
  payments: { payment: Payment; amount: string }[];
};
const [editingMonth, setEditingMonth] = useState<MonthEdit | null>(null);

function openMonthEdit(tenantId: string, unitId: string | null, name: string, unit: string, baseRent: number, month: string, due: number) {
const monthPayments = payments
  .filter((p) => p.invoices?.tenants?.id === tenantId && p.invoices?.billing_period === month)
  .map((p) => ({ payment: p, amount: String(p.amount_paid) }));
setEditingMonth({ tenantId, unitId, name, unit, baseRent, period: month, due: String(due), originalDue: due, payments: monthPayments });
}
const [savingEdit, setSavingEdit] = useState(false);

async function saveEditedPayment() {
if (!editingPayment || !landlordId || savingEdit) return;
const p = editingPayment.payment;
const tenantRef = p.invoices?.tenants;
if (!p.invoices?.id || !tenantRef) { alert("This payment isn't linked to a tenant, so it can't be edited here."); return; }
const amt = Number(editingPayment.amount);
if (!Number.isFinite(amt) || amt <= 0) { alert("Please enter a valid amount."); return; }
const tenant = tenants.find((t) => t.id === tenantRef.id);
setSavingEdit(true);
try {
  const result = await editPayment(supabase, {
    paymentId: p.id,
    currentInvoiceId: p.invoices.id,
    tenantId: tenantRef.id,
    unitId: tenant?.unit_id || null,
    rent: Number(tenant?.units?.base_rent) || 0,
    amount: amt,
    method: editingPayment.method,
    reference: editingPayment.reference.trim() || null,
    period: editingPayment.period,
  });
  if (!result.ok) { alert("Could not save: " + result.error); return; }
  if (result.warnings.length > 0) alert("Saved, but a status could not be updated: " + result.warnings.join("; "));
  setEditingPayment(null);
  loadPayments(landlordId);
  loadUnpaidInvoices(landlordId);
  loadReview(landlordId, reviewPeriod);
} finally {
  setSavingEdit(false);
}
}

async function removePayment(p: Payment) {
if (!landlordId || savingEdit || !p.invoices?.id) return;
const who = (p.invoices.tenants?.full_name || "this tenant") + " (" + (p.invoices.units?.unit_number || "—") + ")";
if (!confirm("Delete this payment of KSh " + Number(p.amount_paid).toLocaleString() + " from " + who + " for " + p.invoices.billing_period + "?\n\nOnly do this for a payment entered by mistake, e.g. saved twice. This cannot be undone.")) return;
setSavingEdit(true);
try {
  const result = await deletePayment(supabase, p.id, p.invoices.id);
  if (!result.ok) { alert("Could not delete: " + result.error); return; }
  setEditingPayment(null);
  setEditingMonth(null);
  loadPayments(landlordId);
  loadUnpaidInvoices(landlordId);
  loadReview(landlordId, reviewPeriod);
} finally {
  setSavingEdit(false);
}
}

async function saveMonthEdit() {
if (!editingMonth || !landlordId || savingEdit) return;
const e = editingMonth;
const due = Number(e.due);
if (!Number.isFinite(due) || due < 0) { alert("Please enter a valid amount due."); return; }
for (const row of e.payments) {
  const amt = Number(row.amount);
  if (!Number.isFinite(amt) || amt <= 0) { alert("Each payment amount must be more than zero."); return; }
}
setSavingEdit(true);
const problems: string[] = [];
try {
  // 1. Amount due first, so payment statuses are re-checked against it.
  if (due !== e.originalDue) {
    const today = new Date();
    const todayStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    const result = await setRentDue(supabase, { tenantId: e.tenantId, unitId: e.unitId, period: e.period, rent: due, dueDate: e.period === period ? todayStr : periodStartDate(e.period) });
    if (!result.ok) problems.push("Amount due: " + result.error);
  }
  // 2. Each payment whose amount changed (same month, same method/reference).
  for (const row of e.payments) {
    const amt = Number(row.amount);
    if (amt === Number(row.payment.amount_paid) || !row.payment.invoices?.id) continue;
    const result = await editPayment(supabase, {
      paymentId: row.payment.id,
      currentInvoiceId: row.payment.invoices.id,
      tenantId: e.tenantId,
      unitId: e.unitId,
      rent: e.baseRent,
      amount: amt,
      method: row.payment.payment_method,
      reference: row.payment.transaction_reference,
      period: e.period,
    });
    if (!result.ok) problems.push("Payment " + (row.payment.transaction_reference || "") + ": " + result.error);
  }
  if (problems.length > 0) alert("Some changes could not be saved:\n" + problems.join("\n"));
  else setEditingMonth(null);
  loadPayments(landlordId);
  loadUnpaidInvoices(landlordId);
  loadReview(landlordId, reviewPeriod);
} finally {
  setSavingEdit(false);
}
}

// Lets the dashboard's "Record Payment" button land here with the form
// already open (/payments?record=1).
useEffect(() => {
if (new URLSearchParams(window.location.search).get("record") === "1") setShowForm(true);
}, []);

// "Send Reminders" on the dashboard links to #rent-status.
useEffect(() => {
if (loading || window.location.hash !== "#rent-status") return;
document.getElementById("rent-status")?.scrollIntoView({ behavior: "smooth" });
}, [loading]);

useEffect(() => {
async function init() {
const { data } = await supabase.auth.getUser();
if (!data.user) { router.push("/landlord/login"); return; }
setLandlordId(data.user.id);
const { data: sessionData } = await supabase.auth.getSession();
setAuthToken(sessionData.session?.access_token || "");
}
init();
}, [router]);

async function loadClaims(token: string) {
setLoadingClaims(true);
try {
const res = await fetch("/api/landlord/payment-claims", { headers: { Authorization: "Bearer " + token } });
const result = await res.json();
if (res.ok) setClaims(result.claims || []);
} catch (e) {
setClaims([]);
} finally {
setLoadingClaims(false);
}
}

useEffect(() => {
if (!authToken) return;
loadClaims(authToken);
}, [authToken]);

// Only the account that receives the bank SMS gets a successful answer here;
// every other landlord gets a 404, so they never see the button.
useEffect(() => {
if (!authToken) return;
(async () => {
try {
const res = await fetch("/api/landlord/sms-payment-log", { headers: { Authorization: "Bearer " + authToken } });
if (!res.ok) { setUnmatchedCount(null); return; }
const result = await res.json();
setUnmatchedCount(Array.isArray(result.entries) ? result.entries.length : 0);
} catch {
setUnmatchedCount(null);
}
})();
}, [authToken]);

async function resolveClaim(claim: PaymentClaim, action: "confirm" | "dismiss") {
if (!authToken || !landlordId) return;
if (action === "dismiss" && !confirm("Dismiss this payment report? Only do this if the tenant made a mistake or duplicate report.")) return;
setResolvingClaimId(claim.id);
try {
const res = await fetch("/api/landlord/payment-claims", {
method: "POST",
headers: { "Content-Type": "application/json", Authorization: "Bearer " + authToken },
body: JSON.stringify({ claimId: claim.id, action }),
});
const result = await res.json();
if (!res.ok) { alert("Could not update this report: " + (result.error || "unknown error")); return; }
loadClaims(authToken);
if (action === "confirm") loadPayments(landlordId);
} catch (err: any) {
alert("Error: " + err.message);
} finally {
setResolvingClaimId(null);
}
}

async function loadTenants(id: string) {
// Supabase can't sort the outer "tenants" rows by a column on the related
// "units" row, so we fetch normally (including unit_sort_key) and sort
// client-side - this puts the Rent Status table in natural unit order
// (A1, A2, ... SHOP B1, ... B1, ...) instead of alphabetical by tenant name.
const { data, error } = await supabase.from("tenants").select("id, full_name, unit_id, phone_number, joined_at, lease_start_date, units(id, unit_number, base_rent, unit_sort_key, properties(property_name))").eq("landlord_id", id).eq("status", "active");
if (error) setLoadError("Some of your data could not be loaded (" + error.message + "). Please refresh the page before trusting the amounts below.");
if (!error && data) {
  const sorted = (data as unknown as (Tenant & { units: (Tenant["units"] & { unit_sort_key?: string }) | null })[]).slice().sort((a, b) => {
    const keyA = a.units?.unit_sort_key;
    const keyB = b.units?.unit_sort_key;
    if (!keyA && !keyB) return 0;
    if (!keyA) return 1;
    if (!keyB) return -1;
    return keyA.localeCompare(keyB);
  });
  setTenants(sorted);
}
}

async function loadUnpaidInvoices(id: string) {
const { data, error } = await supabase.from("invoices").select("id, billing_period, total_due, status, tenant_id, tenants!inner(landlord_id)").eq("tenants.landlord_id", id).neq("status", "paid");
if (error) setLoadError("Some of your data could not be loaded (" + error.message + "). Please refresh the page before trusting the amounts below.");
if (!error && data) setUnpaidInvoices(data as unknown as UnpaidInvoice[]);
}

async function exportLedger() {
if (!authToken) { alert("Please wait for the page to finish loading and try again."); return; }
try {
  const res = await fetch("/api/landlord/ledger-export", { headers: { Authorization: "Bearer " + authToken } });
  if (!res.ok) {
    const result = await res.json().catch(() => ({}));
    alert("Could not export: " + (result.error || "unknown error"));
    return;
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "managika-ledger-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
} catch (e: any) {
  alert("Could not export: " + (e.message || "unknown error"));
}
}

async function loadPayments(id: string) {
setLoading(true);
// Two simple steps instead of one big nested query. Asking for
// payments -> invoices -> tenants in a single request made the database
// check its access rules on every row of all three tables, and it started
// hitting the database's time limit ("statement timeout") - so Payment
// History showed "No payments have been recorded yet" even though there
// were payments. Step 1: this landlord's invoices. Step 2: the payments on
// them, in batches.
const { data: invoiceRows, error: invoiceError } = await supabase
  .from("invoices")
  .select("id, billing_period, total_due, status, tenants!inner(id, full_name, landlord_id), units(unit_number)")
  .eq("tenants.landlord_id", id);
if (invoiceError) {
  setLoadError("Some of your data could not be loaded (" + invoiceError.message + "). Please refresh the page before trusting the amounts below.");
  setLoading(false);
  return;
}
const invoiceById: Record<string, any> = {};
for (const inv of (invoiceRows || []) as any[]) invoiceById[inv.id] = inv;
const ids = Object.keys(invoiceById);
const collected: Payment[] = [];
for (let start = 0; start < ids.length; start += 100) {
  const { data, error } = await supabase
    .from("payments")
    .select("id, amount_paid, payment_method, transaction_reference, paid_at, invoice_id")
    .in("invoice_id", ids.slice(start, start + 100));
  if (error) {
    setLoadError("Some of your data could not be loaded (" + error.message + "). Please refresh the page before trusting the amounts below.");
    setLoading(false);
    return;
  }
  for (const p of (data || []) as any[]) {
    const inv = invoiceById[p.invoice_id];
    collected.push({
      id: p.id,
      amount_paid: p.amount_paid,
      payment_method: p.payment_method,
      transaction_reference: p.transaction_reference,
      paid_at: p.paid_at,
      invoices: inv ? { id: inv.id, billing_period: inv.billing_period, total_due: inv.total_due, status: inv.status, tenants: inv.tenants ? { id: inv.tenants.id, full_name: inv.tenants.full_name } : null, units: inv.units || null } : null,
    });
  }
}
collected.sort((a, b) => String(b.paid_at || "").localeCompare(String(a.paid_at || "")));
setPayments(collected);
setLoading(false);
}

async function loadReview(id: string, month: string) {
setReviewLoading(true);
const result = await loadPeriodStatus(id, month);
setReviewRows(result.rows);
setReviewError(result.error);
setReviewLoading(false);
}

useEffect(() => {
if (!landlordId) return;
loadReview(landlordId, reviewPeriod);
}, [landlordId, reviewPeriod]);

// "Record payment" on a row of the Not-paid list: open the form with that
// tenant and that month already chosen.
function recordForMonth(row: PeriodStatusRow) {
const tenant = tenants.find((t) => t.id === row.tenantId);
if (!tenant) { alert("This tenant is no longer active, so a payment can't be recorded from here."); return; }
setTenantId(tenant.id);
setTenantSearch(tenant.full_name + " — " + (tenant.units?.unit_number || ""));
setApplyTo(reviewPeriod);
setShowForm(true);
window.scrollTo({ top: 0, behavior: "smooth" });
}

useEffect(() => {
if (!landlordId) return;
loadTenants(landlordId);
loadPayments(landlordId);
loadUnpaidInvoices(landlordId);
}, [landlordId]);

async function recordPayment() {
if (!landlordId) { alert("You must be logged in."); return; }
if (savingPayment) return; // already submitting - ignore a second click/tap instead of recording the payment twice
if (!tenantId) { alert("Please select a tenant."); return; }
const amt = Number(amount);
if (!Number.isFinite(amt) || amt <= 0) { alert("Please enter a valid amount."); return; }
const tenant = tenants.find((t) => t.id === tenantId);
if (!tenant || !tenant.units) { alert("This tenant has no unit assigned yet."); return; }
const rent = Number(tenant.units.base_rent) || 0;
setSavingPayment(true);
try {

const today = new Date();
const result = await recordRentPayment(supabase, {
  tenantId,
  unitId: tenant.unit_id,
  rent,
  amount: amt,
  method,
  reference: reference.trim() || null,
  currentPeriod: period,
  applyTo,
  movedIn: String(tenant.lease_start_date || tenant.joined_at || "").slice(0, 10) || null,
  currentDueDate: today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0"),
});
if (!result.ok) {
  alert(result.code === "23505" ? "A payment with this reference is already recorded." : "Error recording payment: " + result.error);
  return;
}
if (result.statusErrors.length > 0) alert("Payment saved, but invoice status could not be updated: " + result.statusErrors.join("; "));

const months = Array.from(new Set(result.allocations.map((a) => a.period)));
if (months.length > 1 || months[0] !== period) {
  alert("Payment saved and applied to: " + result.allocations.map((a) => a.period + " (KSh " + a.amount.toLocaleString() + ")").join(", "));
}

// Notify the tenant (WhatsApp + SMS) - ONE message naming every month this
// payment covered. Best-effort: the payment is already saved regardless.
if (result.statusErrors.length === 0) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token || "";
    await fetch("/api/send-payment-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
      body: JSON.stringify({ invoiceId: result.allocations[0].invoiceId, invoiceIds: result.allocations.map((a) => a.invoiceId), amountPaid: amt, reference: reference.trim() || method }),
    });
  } catch {
    // Silently ignore - payment recording already succeeded above.
  }
}

setTenantId(""); setTenantSearch(""); setAmount(""); setReference(""); setMethod("mpesa"); setApplyTo("auto"); setShowForm(false);
loadPayments(landlordId);
loadUnpaidInvoices(landlordId);
loadReview(landlordId, reviewPeriod);

} finally {
setSavingPayment(false);
}

}

// Shared by the per-row "Send Reminder" button and "Remind All Unpaid" -
// does the actual send and hands back a plain result instead of alert()ing,
// so the bulk sender can run through everyone quietly and report one
// summary at the end instead of a popup per tenant.
async function sendReminderTo(summary: TenantSummary): Promise<{ ok: boolean; error?: string }> {
if (!summary.tenant.phone_number) return { ok: false, error: "no phone number on file" };
try {
// Each month named separately, never one mixed total.
const owedParts = [
  ...summary.priorParts.map((x) => "KSh " + x.owed.toLocaleString() + " for " + x.period),
  ...(summary.monthBalance > 0 ? ["KSh " + summary.monthBalance.toLocaleString() + " for " + period] : []),
];
const message = "Hi " + summary.tenant.full_name + ", this is a reminder from Managika Homes that your rent balance of " + owedParts.join(" and ") + " is due. Please make payment at your earliest convenience.";
const { data: sessionData } = await supabase.auth.getSession();
const token = sessionData.session?.access_token || "";
const res = await fetch("/api/send-reminder", {
method: "POST",
headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
body: JSON.stringify({ tenantId: summary.tenant.id, message: message }),
});
const result = await res.json();
if (!res.ok) return { ok: false, error: result.error || "unknown error" };
return { ok: true };
} catch (err: any) {
return { ok: false, error: err.message || "network error" };
}
}

async function sendReminder(summary: TenantSummary) {
setSendingId(summary.tenant.id);
const result = await sendReminderTo(summary);
setSendingId(null);
if (!result.ok) { alert("Failed to send reminder: " + result.error); return; }
alert("Reminder sent to " + summary.tenant.full_name + "!");
}

// One button to nudge every tenant who isn't fully paid up, instead of
// clicking "Send Reminder" one row at a time. Runs sequentially (not
// Promise.all) so it doesn't fire a burst of concurrent SMS/WhatsApp sends
// at once - fine at the tenant counts this app deals with, and easier to
// reason about if one send fails partway through.
async function remindAllUnpaid() {
if (loadError) { alert("Part of this page failed to load, so I can't be sure who has paid. Please refresh the page first."); return; }
// Only tenants who really owe something - a tenant with no unit assigned has
// nothing expected, so they must not be told "KSh 0 is due".
const unpaidSummaries = tenantSummaries.filter((s) => s.balance > 0);
if (unpaidSummaries.length === 0) { alert("Everyone is paid up for " + period + " - nothing to send."); return; }

const withPhone = unpaidSummaries.filter((s) => s.tenant.phone_number);
const withoutPhoneCount = unpaidSummaries.length - withPhone.length;
if (withPhone.length === 0) { alert("None of the unpaid tenants have a phone number on file."); return; }

const confirmMessage =
  "Send a rent reminder to " + withPhone.length + " unpaid tenant" + (withPhone.length === 1 ? "" : "s") + " now?" +
  (withoutPhoneCount > 0 ? " (" + withoutPhoneCount + " more have no phone number on file and will be skipped.)" : "");
if (!confirm(confirmMessage)) return;

setRemindingAll(true);
let sent = 0;
const failed: string[] = [];
for (const summary of withPhone) {
  const result = await sendReminderTo(summary);
  if (result.ok) sent++;
  else failed.push(summary.tenant.full_name + (result.error ? " (" + result.error + ")" : ""));
}
setRemindingAll(false);

let summaryMessage = "Sent " + sent + " of " + withPhone.length + " reminder" + (withPhone.length === 1 ? "" : "s") + ".";
if (withoutPhoneCount > 0) summaryMessage += " " + withoutPhoneCount + " skipped (no phone number).";
if (failed.length > 0) summaryMessage += "\n\nDid not go through: " + failed.join(", ");
alert(summaryMessage);
}

const currentPayments = payments.filter((p) => p.invoices?.billing_period === period);

// How much has already been paid against each unpaid invoice, so a
// partially-paid older invoice doesn't get counted as its full total_due.
const paidByInvoice: Record<string, number> = {};
for (const p of payments) {
if (!p.invoices?.id) continue;
paidByInvoice[p.invoices.id] = (paidByInvoice[p.invoices.id] || 0) + (Number(p.amount_paid) || 0);
}

const tenantSummaries: TenantSummary[] = tenants.map((tenant) => {
// Match by tenant id, not name - two tenants sharing a common name (not
// rare in practice) would otherwise have their payments merged, making
// one look paid because of the other's payment.
const tenantPayments = currentPayments.filter((p) => p.invoices?.tenants?.id === tenant.id);
const baseRent = Number(tenant.units?.base_rent) || 0;
// This month's real invoice also carries the water charge (rent + water),
// so use it when it is bigger than the plain rent - otherwise a tenant who
// paid only the rent would show "Paid" while the invoice is still open.
// When this month's invoice exists, ITS total is what's due (it may have
// been edited with the Edit button, or carry water). Otherwise unit rent.
const thisMonthInvoiceTotals = [
  ...unpaidInvoices.filter((inv) => inv.tenant_id === tenant.id && inv.billing_period === period).map((inv) => Number(inv.total_due) || 0),
  ...tenantPayments.map((p) => Number(p.invoices?.total_due) || 0),
];
const expected = thisMonthInvoiceTotals.length > 0 ? Math.max(...thisMonthInvoiceTotals) : baseRent;
const paid = tenantPayments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);

// Any unpaid/partially-paid invoice from a period OTHER than the current
// one - this is what used to silently vanish once the next month began,
// since everything else on this page only ever looks at `period`.
const priorInvoices = unpaidInvoices.filter((inv) => inv.tenant_id === tenant.id && inv.billing_period !== period);
const priorDue = priorInvoices.reduce((sum, inv) => sum + (Number(inv.total_due) || 0), 0);
const priorPaid = priorInvoices.reduce((sum, inv) => sum + (paidByInvoice[inv.id] || 0), 0);
const priorBalance = Math.max(priorDue - priorPaid, 0);

const priorParts = priorInvoices
  .map((inv) => ({ period: inv.billing_period, owed: Math.max((Number(inv.total_due) || 0) - (paidByInvoice[inv.id] || 0), 0) }))
  .filter((x) => x.owed > 0)
  .sort((a, b) => (periodToIndex(a.period) ?? 0) - (periodToIndex(b.period) ?? 0));

// This month on its own.
const monthBalance = Math.max(expected - paid, 0);
let status = "Unpaid";
if (expected > 0 && monthBalance === 0) status = "Paid";
else if (paid > 0) status = "Partially Paid";
const balance = monthBalance + priorBalance;
return { tenant, expected, paid, monthBalance, balance, status, priorBalance, priorParts };
});

const rentExpected = tenantSummaries.reduce((sum, item) => sum + item.expected, 0);
const rentCollected = tenantSummaries.reduce((sum, item) => sum + item.paid, 0);
// True total owed across every unpaid period, not just this month - see
// priorBalance above.
const outstanding = tenantSummaries.reduce((sum, item) => sum + item.balance, 0);
const paidTenants = tenantSummaries.filter((item) => item.status === "Paid").length;
const unpaidTenants = tenantSummaries.filter((item) => item.status === "Unpaid").length;
const notFullyPaidCount = tenantSummaries.filter((item) => item.balance > 0).length;

function statusClasses(status: string) {
if (status === "Paid") return "bg-green-100 text-green-700";
if (status === "Partially Paid") return "bg-amber-100 text-amber-700";
return "bg-red-100 text-red-700";
}

return (
<main className="min-h-screen city-skyline-page">
<div className="h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400" />
<header className="border-b bg-white">
<div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
<div>
<h1 className="text-2xl font-bold text-slate-900">MANAGIKA HOMES</h1>
<p className="text-sm text-slate-500">Property Management Made Simple</p>
</div>
<a href="/landlord/dashboard" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50">Dashboard</a>
</div>
</header>

  <section className="mx-auto max-w-7xl px-6 py-8">
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-3xl">💰</span>
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Rent & Payments</h2>
          <p className="mt-1 text-slate-500">Track rent, payments, invoices and balances — {period}.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {unmatchedCount !== null && (
          <a href="/payments/unmatched" className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition">
            📩 Unmatched bank SMS
            {unmatchedCount > 0 && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-sm font-semibold text-red-700">{unmatchedCount}</span>}
          </a>
        )}
        <a href="/landlord/reports" className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition">📊 Monthly Report</a>
        <button onClick={exportLedger} className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition">⬇ Export CSV</button>
        <button onClick={() => setShowForm(true)} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white shadow-lg shadow-slate-900/10 hover:-translate-y-0.5 hover:bg-slate-800 transition">+ Record Payment</button>
      </div>
    </div>

    {showForm && (
      <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-xl font-bold text-slate-900">Record Payment</h3>
        {tenants.length === 0 ? (
          <p className="text-slate-500">Add an active tenant with a unit assigned first.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-5">
            <div className="relative">
              <label className="mb-2 block text-sm font-medium text-slate-700">Tenant</label>
              <input
                type="text"
                value={tenantSearch}
                onChange={(e) => { setTenantSearch(e.target.value); setTenantId(""); setTenantDropdownOpen(true); }}
                onFocus={() => setTenantDropdownOpen(true)}
                onBlur={() => setTenantDropdownOpen(false)}
                placeholder="Type a name or unit number..."
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
              {tenantDropdownOpen && (() => {
                const query = tenantSearch.trim().toLowerCase();
                const matches = tenants.filter((t) => t.units && (query === "" || t.full_name.toLowerCase().includes(query) || t.units.unit_number.toLowerCase().includes(query)));
                return (
                  <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {matches.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-500">No matching tenant.</p>
                    ) : (
                      matches.map((tenant) => (
                        <button
                          type="button"
                          key={tenant.id}
                          // onMouseDown (not onClick) fires before the input's onBlur closes
                          // the dropdown, so the click actually registers instead of the list
                          // disappearing out from under the tap first.
                          onMouseDown={() => {
                            setTenantId(tenant.id);
                            setTenantSearch(tenant.full_name + " — " + tenant.units?.unit_number);
                            setTenantDropdownOpen(false);
                          }}
                          className="block w-full px-4 py-2.5 text-left text-sm hover:bg-amber-50"
                        >
                          {tenant.full_name} — {tenant.units?.unit_number} (KSh {Number(tenant.units?.base_rent).toLocaleString()})
                        </button>
                      ))
                    )}
                  </div>
                );
              })()}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Amount Paid (KSh)</label>
              <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 10000" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
                <option value="mpesa">M-Pesa</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Reference</label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. M-Pesa code" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Apply to month</label>
              <select value={applyTo} onChange={(e) => setApplyTo(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
                <option value="auto">Auto — oldest unpaid first</option>
                {recentPeriods.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        )}
        {tenantId && applyTo === "auto" && (() => {
          const earlier = unpaidInvoices
            .filter((inv) => inv.tenant_id === tenantId && (periodToIndex(inv.billing_period) ?? Infinity) < (periodToIndex(period) ?? 0))
            .map((inv) => ({ period: inv.billing_period, owed: Math.max((Number(inv.total_due) || 0) - (paidByInvoice[inv.id] || 0), 0) }))
            .filter((x) => x.owed > 0)
            .sort((a, b) => (periodToIndex(a.period) ?? 0) - (periodToIndex(b.period) ?? 0));
          return earlier.length > 0 ? (
            <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This tenant still owes {earlier.map((x) => x.period + " (KSh " + x.owed.toLocaleString() + ")").join(", ")}. The payment will clear {earlier.length === 1 ? "that" : "those, oldest first,"} before anything goes to {period}.
            </p>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No earlier unpaid months on record — this payment goes to {period}, unless this tenant has no {shiftPeriod(period, -1)} invoice yet, in which case it goes to {shiftPeriod(period, -1)} first.</p>
          );
        })()}
        <div className="mt-6 flex gap-3">
          <button onClick={recordPayment} disabled={savingPayment} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-60">{savingPayment ? "Saving..." : "Save Payment"}</button>
          <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    )}

    <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Rent Expected</p>
        <p className="mt-2 text-3xl font-bold">KSh {rentExpected.toLocaleString()}</p>
        <p className="mt-1 text-sm text-slate-400">{period}</p>
      </div>
      <div className="rounded-xl border bg-gradient-to-br from-green-600 to-green-700 p-6 shadow-sm text-white">
        <p className="text-sm text-green-100">Rent Collected</p>
        <p className="mt-2 text-3xl font-bold">KSh {rentCollected.toLocaleString()}</p>
        <p className="mt-1 text-sm text-green-100">{paidTenants} tenant{paidTenants === 1 ? "" : "s"} fully paid</p>
      </div>
      <div className="rounded-xl border bg-gradient-to-br from-red-500 to-red-600 p-6 shadow-sm text-white">
        <p className="text-sm text-red-100">Outstanding</p>
        <p className="mt-2 text-3xl font-bold">KSh {outstanding.toLocaleString()}</p>
        <p className="mt-1 text-sm text-red-100">{unpaidTenants} unpaid · all unpaid periods</p>
      </div>
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Payments Logged</p>
        <p className="mt-2 text-3xl font-bold">{payments.length}</p>
        <p className="mt-1 text-sm text-slate-400">All recorded payments</p>
      </div>
    </div>

    {(loadingClaims ? false : claims.length > 0) && (
      <div className="mb-8 overflow-hidden rounded-xl border border-amber-300 bg-amber-50 shadow-sm">
        <div className="border-b border-amber-200 px-6 py-5">
          <h3 className="text-xl font-semibold text-amber-900">Tenant-Reported Payments</h3>
          <p className="mt-1 text-sm text-amber-700">Tenants who tapped &quot;I&apos;ve Paid&quot; after sending money manually. Confirm once you&apos;ve verified it landed.</p>
        </div>
        <div className="divide-y divide-amber-100">
          {claims.map((claim) => (
            <div key={claim.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-slate-900">{claim.tenants?.full_name || "Unknown tenant"} — {claim.tenants?.units?.unit_number || "Unassigned"}</p>
                <p className="text-sm text-slate-500">
                  {claim.billing_period || "—"} · {claim.method === "bank" ? "Bank transfer" : "Manual M-Pesa"}
                  {claim.amount ? " · KSh " + Number(claim.amount).toLocaleString() : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => resolveClaim(claim, "confirm")} disabled={resolvingClaimId === claim.id} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                  {resolvingClaimId === claim.id ? "Working..." : "Confirm"}
                </button>
                <button onClick={() => resolveClaim(claim, "dismiss")} disabled={resolvingClaimId === claim.id} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {loadError && (
      <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
    )}
    <div id="rent-status" className="mb-8 overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-b px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold">Rent Status — {period}</h3>
          <p className="mt-1 text-sm text-slate-500">Current rent position for each active tenant.</p>
        </div>
        {notFullyPaidCount > 0 && (
          <button onClick={remindAllUnpaid} disabled={remindingAll} className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50">
            {remindingAll ? "Sending reminders..." : "🔔 Remind All Unpaid (" + notFullyPaidCount + ")"}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Tenant</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Property</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Unit</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Billing Period</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Expected</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Paid</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Balance</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Status</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Earlier months owed</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Reminder</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="px-6 py-10 text-center text-slate-500">Loading payment information...</td></tr>
            ) : tenantSummaries.length === 0 ? (
              <tr><td colSpan={11} className="px-6 py-10 text-center text-slate-500">No active tenants have been added yet.</td></tr>
            ) : (
              tenantSummaries.map((item) => (
                <tr key={item.tenant.id} className="border-t">
                  <td className="whitespace-nowrap px-6 py-4 font-medium">{item.tenant.full_name}</td>
                  <td className="whitespace-nowrap px-6 py-4">{item.tenant.units?.properties?.property_name || "—"}</td>
                  <td className="whitespace-nowrap px-6 py-4">{item.tenant.units?.unit_number || "Unassigned"}</td>
                  <td className="whitespace-nowrap px-6 py-4">{period}</td>
                  <td className="whitespace-nowrap px-6 py-4">KSh {item.expected.toLocaleString()}</td>
                  <td className={"whitespace-nowrap px-6 py-4 font-medium " + (item.paid > 0 ? "text-green-700" : "text-slate-400")}>KSh {item.paid.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-6 py-4 font-medium">KSh {item.monthBalance.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-6 py-4"><span className={"inline-flex rounded-full px-3 py-1 text-xs font-semibold " + statusClasses(item.status)}>{item.status}</span></td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {item.priorParts.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      item.priorParts.map((x) => (
                        <div key={x.period} className="font-medium text-red-700">KSh {x.owed.toLocaleString()} <span className="font-normal text-red-600">({x.period})</span></div>
                      ))
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {item.balance > 0 && (
                      <button onClick={() => sendReminder(item)} disabled={sendingId === item.tenant.id} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                        {sendingId === item.tenant.id ? "Sending..." : "Send Reminder"}
                      </button>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <button onClick={() => openMonthEdit(item.tenant.id, item.tenant.unit_id, item.tenant.full_name, item.tenant.units?.unit_number || "", Number(item.tenant.units?.base_rent) || 0, period, item.expected)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>

    <div id="not-paid" className="mb-8 overflow-hidden rounded-xl border bg-white shadow-sm">
      {(() => {
        const owing = reviewRows.filter((r) => r.status !== "paid").sort((a, b) => b.balance - a.balance);
        const totalOwed = owing.reduce((sum, r) => sum + r.balance, 0);
        const paidLate = reviewRows.filter((r) => r.status === "paid" && r.lastPaidAt && (periodToIndex(currentPeriodOf(r.lastPaidAt)) ?? 0) > (periodToIndex(reviewPeriod) ?? 0)).length;
        return (
          <>
            <div className="border-b px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold">Not paid in full — {reviewPeriod}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {reviewLoading ? "Loading..." : owing.length === 0 ? "Everyone paid " + reviewPeriod + " in full." : owing.length + " tenant" + (owing.length === 1 ? "" : "s") + " still owe KSh " + totalOwed.toLocaleString() + " for " + reviewPeriod + "."}
                  {!reviewLoading && paidLate > 0 && " " + paidLate + " paid it late, after the month ended."}
                </p>
              </div>
              <select value={reviewPeriod} onChange={(e) => setReviewPeriod(e.target.value)} className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm">
                {recentPeriods.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {reviewError && <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">Could not load this month ({reviewError}). Please refresh.</div>}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Tenant</th>
                    <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Unit</th>
                    <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Due</th>
                    <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Paid</th>
                    <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Balance</th>
                    <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Status</th>
                    <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Last payment</th>
                    <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600"></th>
                  </tr>
                </thead>
                <tbody>
                  {reviewLoading ? (
                    <tr><td colSpan={8} className="px-6 py-10 text-center text-slate-500">Loading {reviewPeriod}...</td></tr>
                  ) : owing.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-10 text-center text-slate-500">Nobody owes anything for {reviewPeriod}. 🎉</td></tr>
                  ) : (
                    owing.map((row) => (
                      <tr key={row.tenantId + (row.invoiceId || "")} className="border-t">
                        <td className="whitespace-nowrap px-6 py-4 font-medium">
                          {row.name}
                          {row.movedOut && <span className="ml-2 text-xs font-normal text-slate-400">(moved out)</span>}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">{row.unit || "—"}</td>
                        <td className="whitespace-nowrap px-6 py-4">KSh {row.due.toLocaleString()}</td>
                        <td className={"whitespace-nowrap px-6 py-4 font-medium " + (row.paid > 0 ? "text-green-700" : "text-slate-400")}>KSh {row.paid.toLocaleString()}</td>
                        <td className="whitespace-nowrap px-6 py-4 font-semibold text-red-700">KSh {row.balance.toLocaleString()}</td>
                        <td className="whitespace-nowrap px-6 py-4"><span className={"inline-flex rounded-full px-3 py-1 text-xs font-semibold " + statusClasses(row.status === "partial" ? "Partially Paid" : "Unpaid")}>{row.status === "partial" ? "Partially Paid" : "Unpaid"}</span></td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{row.lastPaidAt ? new Date(row.lastPaidAt).toLocaleDateString() : "—"}</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {!row.movedOut && (
                            <div className="flex gap-2">
                              <button onClick={() => recordForMonth(row)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                Record payment
                              </button>
                              <button onClick={() => openMonthEdit(row.tenantId, row.unitId, row.name, row.unit, row.rent, reviewPeriod, row.due)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                Edit
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}
    </div>

    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-b px-6 py-5">
        <h3 className="text-xl font-semibold">Payment History</h3>
        <p className="mt-1 text-sm text-slate-500">All payments recorded for your tenants.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Tenant</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Unit</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Amount</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Period</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Method</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Reference</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Date</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600">Status</th>
              <th className="whitespace-nowrap px-6 py-4 text-left text-sm font-semibold text-slate-600"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-6 py-10 text-center text-slate-500">Loading payments...</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={9} className="px-6 py-10 text-center text-slate-500">No payments have been recorded yet.</td></tr>
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
                  <td className="whitespace-nowrap px-6 py-4">
                    <button
                      onClick={() => setEditingPayment({ payment, amount: String(payment.amount_paid), method: payment.payment_method, reference: payment.transaction_reference || "", period: payment.invoices?.billing_period || period })}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  {editingPayment && (() => {
    const monthOptions = Array.from(new Set([editingPayment.payment.invoices?.billing_period || "", ...recentPeriods])).filter(Boolean);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" onClick={() => !savingEdit && setEditingPayment(null)}>
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-bold text-slate-900">Edit payment</h3>
          <p className="mt-1 text-sm text-slate-500">{editingPayment.payment.invoices?.tenants?.full_name || "—"} · Unit {editingPayment.payment.invoices?.units?.unit_number || "—"} · paid {new Date(editingPayment.payment.paid_at).toLocaleDateString()}</p>
          <div className="mt-5 grid gap-4">
            <label className="block text-sm font-medium text-slate-700">Amount (KSh)
              <input type="number" min="0" value={editingPayment.amount} onChange={(e) => setEditingPayment({ ...editingPayment, amount: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-amber-500" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Counts for month
              <select value={editingPayment.period} onChange={(e) => setEditingPayment({ ...editingPayment, period: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-amber-500">
                {monthOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">Method
              <select value={editingPayment.method} onChange={(e) => setEditingPayment({ ...editingPayment, method: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-amber-500">
                <option value="mpesa">M-Pesa</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">Reference
              <input type="text" value={editingPayment.reference} onChange={(e) => setEditingPayment({ ...editingPayment, reference: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-amber-500" />
            </label>
          </div>
          <p className="mt-4 text-xs text-slate-500">Saving does not send the tenant a message.</p>
          <div className="mt-5 flex gap-3">
            <button onClick={saveEditedPayment} disabled={savingEdit} className="rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-800 disabled:opacity-60">{savingEdit ? "Saving..." : "Save"}</button>
            <button onClick={() => setEditingPayment(null)} disabled={savingEdit} className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button onClick={() => removePayment(editingPayment.payment)} disabled={savingEdit} className="ml-auto rounded-lg border border-red-300 bg-white px-4 py-2.5 font-medium text-red-700 hover:bg-red-50 disabled:opacity-60">Delete</button>
          </div>
        </div>
      </div>
    );
  })()}

  {editingMonth && (() => {
    const e = editingMonth;
    const paidTotal = e.payments.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const balance = Math.max((Number(e.due) || 0) - paidTotal, 0);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" onClick={() => !savingEdit && setEditingMonth(null)}>
        <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(ev) => ev.stopPropagation()}>
          <h3 className="text-lg font-bold text-slate-900">Edit — {e.period}</h3>
          <p className="mt-1 text-sm text-slate-500">{e.name} · Unit {e.unit || "—"}</p>

          <p className="mt-5 text-sm font-semibold text-slate-700">Amount paid</p>
          {e.payments.length === 0 ? (
            <p className="mt-2 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">No payments recorded for {e.period} yet. Use &quot;Record payment&quot; to add one.</p>
          ) : (
            <div className="mt-2 grid gap-3">
              {e.payments.map((row, i) => (
                <div key={row.payment.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">
                      Paid {new Date(row.payment.paid_at).toLocaleDateString()} · {row.payment.payment_method.replace("_", " ")}{row.payment.transaction_reference ? " · " + row.payment.transaction_reference : ""}
                    </p>
                    <button onClick={() => removePayment(row.payment)} disabled={savingEdit} className="shrink-0 text-xs font-medium text-red-700 hover:underline disabled:opacity-50">Delete</button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={row.amount}
                    onChange={(ev) => {
                      const next = e.payments.slice();
                      next[i] = { ...row, amount: ev.target.value };
                      setEditingMonth({ ...e, payments: next });
                    }}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-amber-500"
                  />
                </div>
              ))}
            </div>
          )}

          <label className="mt-5 block text-sm font-semibold text-slate-700">Amount due for {e.period} (KSh)
            <input type="number" min="0" value={e.due} onChange={(ev) => setEditingMonth({ ...e, due: ev.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 font-normal outline-none focus:border-amber-500" />
          </label>
          <p className="mt-1 text-xs text-slate-500">Usual rent KSh {e.baseRent.toLocaleString()}. Includes any water charge. Leave it as it is to change only what was paid.</p>

          <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm">
            Paid KSh {paidTotal.toLocaleString()} of KSh {(Number(e.due) || 0).toLocaleString()} ·{" "}
            <span className={balance > 0 ? "font-semibold text-red-700" : "font-semibold text-green-700"}>{balance > 0 ? "Balance KSh " + balance.toLocaleString() : "Fully paid"}</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">Saving does not send the tenant a message. To move a payment to another month, use Edit in Payment History.</p>

          <div className="mt-5 flex gap-3">
            <button onClick={saveMonthEdit} disabled={savingEdit} className="rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-800 disabled:opacity-60">{savingEdit ? "Saving..." : "Save"}</button>
            <button onClick={() => setEditingMonth(null)} disabled={savingEdit} className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      </div>
    );
  })()}

  <footer className="mt-10 border-t bg-white">
    <div className="mx-auto max-w-7xl px-6 py-6 text-sm text-slate-500">© 2026 Managika Homes. Property management made simple.</div>
  </footer>
</main>

);
}
