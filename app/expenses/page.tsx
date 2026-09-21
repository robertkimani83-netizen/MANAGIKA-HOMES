"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Not double-entry accounting - a landlord asked "can you at least show me
// income vs. expenses, not just money coming in" and this is the honest,
// buildable version of that: a dated, categorized expense log, weighed
// against the same "collected this month" figure the dashboard already
// computes. Pairs with the existing ledger export (a payments-only CSV) as
// the app's two lightweight stand-ins for real accounting software.

const CATEGORIES = ["maintenance", "utilities", "staff", "insurance", "taxes", "supplies", "other"];

// Today's date in the browser's own (local) time zone. toISOString() is UTC,
// which is 3 hours behind Kenya/Qatar, so between midnight and 3 a.m. it
// still says "yesterday" - and on the 1st, "last month".
function localDateString(d: Date = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function currentPeriod() {
  const d = new Date();
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return names[d.getMonth()] + " " + d.getFullYear();
}

function formatMoney(n: number) {
  return "KSh " + Math.round(n).toLocaleString();
}

export default function ExpensesPage() {
  const router = useRouter();
  const [landlordId, setLandlordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<{ id: string; property_name: string }[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [collectedThisMonth, setCollectedThisMonth] = useState(0);

  const [propertyId, setPropertyId] = useState("");
  const [category, setCategory] = useState("maintenance");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => localDateString());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/landlord/login"); return; }
      const id = data.user.id;
      setLandlordId(id);

      // Properties, expenses, and the collected-this-month figure are all
      // independent of each other - fired together instead of one after
      // another so this page doesn't wait on three round trips in a row.
      const [{ data: propertyRows }] = await Promise.all([
        supabase.from("properties").select("id, property_name").eq("landlord_id", id).order("property_name", { ascending: true }),
        loadExpenses(id),
        loadCollected(id),
      ]);
      setProperties(propertyRows || []);
      setLoading(false);
    }
    init();
  }, [router]);

  async function loadExpenses(id: string) {
    const { data } = await supabase.from("expenses").select("id, category, description, amount, expense_date, property_id, properties(property_name)").eq("landlord_id", id).order("expense_date", { ascending: false });
    setExpenses(data || []);
  }

  // Same "collected this billing period" logic already used on the
  // dashboard and Payments page - reused here so Net Income lines up with
  // the numbers a landlord already sees elsewhere in the app.
  async function loadCollected(id: string) {
    const period = currentPeriod();
    const { data: tenantRows } = await supabase.from("tenants").select("id").eq("landlord_id", id);
    const tenantIds = (tenantRows || []).map((t) => t.id);
    if (tenantIds.length === 0) { setCollectedThisMonth(0); return; }
    const { data: invoiceRows } = await supabase.from("invoices").select("id").in("tenant_id", tenantIds).eq("billing_period", period);
    const invoiceIds = (invoiceRows || []).map((i) => i.id);
    if (invoiceIds.length === 0) { setCollectedThisMonth(0); return; }
    const { data: paymentRows } = await supabase.from("payments").select("amount_paid").in("invoice_id", invoiceIds);
    const total = (paymentRows || []).reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
    setCollectedThisMonth(total);
  }

  async function addExpense() {
    if (!landlordId) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setError("Enter a valid amount."); return; }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("expenses").insert({
      landlord_id: landlordId,
      property_id: propertyId || null,
      category,
      description: description.trim() || null,
      amount: amt,
      expense_date: expenseDate,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setDescription("");
    setAmount("");
    await loadExpenses(landlordId);
  }

  async function deleteExpense(id: string) {
    if (!landlordId) return;
    if (!confirm("Delete this expense?")) return;
    const { error: deleteError } = await supabase.from("expenses").delete().eq("id", id).eq("landlord_id", landlordId);
    if (deleteError) { alert("Could not delete this expense: " + deleteError.message); return; }
    await loadExpenses(landlordId);
  }

  const period = currentPeriod();
  const expensesThisMonth = expenses
    .filter((e) => {
      const d = new Date(e.expense_date);
      const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      return names[d.getMonth()] + " " + d.getFullYear() === period;
    })
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const netThisMonth = collectedThisMonth - expensesThisMonth;

  if (loading) {
    return (<main className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500">Loading expenses...</main>);
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MANAGIKA HOMES</h1>
            <p className="text-sm text-gray-500">Property Management Made Simple</p>
          </div>
          <a href="/landlord/dashboard" className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700">Back to Dashboard</a>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Expenses</h2>
        <p className="text-gray-500 mb-8">Log what you spend so you can see income vs. expenses, not just money coming in. This isn&apos;t full accounting software - for that, use the ledger export on your Payments page with an accountant.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <p className="text-sm text-gray-500">Collected this month</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{formatMoney(collectedThisMonth)}</p>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <p className="text-sm text-gray-500">Expenses this month</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{formatMoney(expensesThisMonth)}</p>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <p className="text-sm text-gray-500">Net this month</p>
            <p className={"text-2xl font-bold mt-1 " + (netThisMonth >= 0 ? "text-slate-900" : "text-rose-600")}>{formatMoney(netThisMonth)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4">Log an expense</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Property (optional)</label>
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
                <option value="">All properties</option>
                {properties.map((p) => (<option key={p.id} value={p.id}>{p.property_name}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
                {CATEGORIES.map((c) => (<option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Amount (KSh)</label>
              <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Date</label>
              <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">Description (optional)</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Plumber callout, Unit 4" className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          <button onClick={addExpense} disabled={saving} className="mt-4 rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {saving ? "Saving..." : "Add expense"}
          </button>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="text-xl font-semibold mb-4">All expenses</h3>
          {expenses.length === 0 ? (
            <p className="text-gray-500">No expenses logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Property</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">Description</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{e.expense_date}</td>
                      <td className="py-2 pr-4">{e.properties?.property_name || "All"}</td>
                      <td className="py-2 pr-4 capitalize">{e.category}</td>
                      <td className="py-2 pr-4">{e.description || "—"}</td>
                      <td className="py-2 pr-4">{formatMoney(Number(e.amount))}</td>
                      <td className="py-2 text-right">
                        <button onClick={() => deleteExpense(e.id)} className="text-rose-600 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
