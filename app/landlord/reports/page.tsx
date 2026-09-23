"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// One-page monthly report a landlord can print or "Save as PDF" and hand to
// an owner or accountant: who paid, who owes, what was spent, what is left.
// It reads the same tables the dashboard does (through the landlord's own
// login, so nobody else's data can appear here) and follows the same rule
// for the CURRENT month: an occupied unit is expected to pay at least its
// base rent even if the month's invoice has not been created yet.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type PeriodOption = { period: string; year: number; month: number };

function periodOptions(count: number): PeriodOption[] {
  const now = new Date();
  const out: PeriodOption[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ period: MONTHS[d.getMonth()] + " " + d.getFullYear(), year: d.getFullYear(), month: d.getMonth() });
  }
  return out;
}

function isoDay(year: number, month: number) {
  // month may be 12 (= January of next year); Date handles the roll-over.
  const d = new Date(year, month, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01";
}

function money(n: number) {
  return "KSh " + Math.round(n).toLocaleString();
}

type Row = { tenantId: string; tenant: string; property: string; unit: string; billed: number; paid: number; balance: number; status: "Paid" | "Partial" | "Unpaid" };
type ExpenseRow = { id: string; category: string; description: string | null; amount: number; expense_date: string; property: string };

export default function MonthlyReportPage() {
  const router = useRouter();
  const options = periodOptions(12);
  const [landlordId, setLandlordId] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/landlord/login"); return; }
      setLandlordId(data.user.id);
    }
    init();
  }, [router]);

  useEffect(() => {
    if (!landlordId) return;
    let cancelled = false;
    async function load(id: string) {
      setLoading(true);
      setError(null);
      const opt = periodOptions(12)[selected];
      const isCurrent = selected === 0;
      const start = isoDay(opt.year, opt.month);
      const end = isoDay(opt.year, opt.month + 1);

      const [tenantsRes, invoicesRes, expensesRes] = await Promise.all([
        supabase.from("tenants").select("id, full_name, status, unit_id, units(unit_number, base_rent, status, properties(property_name))").eq("landlord_id", id),
        supabase.from("invoices").select("id, tenant_id, total_due, tenants!inner(landlord_id)").eq("tenants.landlord_id", id).eq("billing_period", opt.period),
        supabase.from("expenses").select("id, category, description, amount, expense_date, properties(property_name)").eq("landlord_id", id).gte("expense_date", start).lt("expense_date", end).order("expense_date", { ascending: true }),
      ]);
      if (cancelled) return;
      const firstError = tenantsRes.error || invoicesRes.error || expensesRes.error;
      if (firstError) {
        setError("The report could not be loaded (" + firstError.message + "). Please refresh the page and try again.");
        setLoading(false);
        return;
      }

      const invoices = (invoicesRes.data || []) as any[];
      const invoiceIds = invoices.map((i) => i.id);
      let payments: any[] = [];
      if (invoiceIds.length > 0) {
        const paymentsRes = await supabase.from("payments").select("invoice_id, amount_paid").in("invoice_id", invoiceIds);
        if (cancelled) return;
        if (paymentsRes.error) {
          setError("The report could not be loaded (" + paymentsRes.error.message + "). Please refresh the page and try again.");
          setLoading(false);
          return;
        }
        payments = paymentsRes.data || [];
      }

      const tenantByInvoice: Record<string, string> = {};
      const invoiceTotalByTenant: Record<string, number> = {};
      for (const inv of invoices) {
        tenantByInvoice[inv.id] = inv.tenant_id;
        invoiceTotalByTenant[inv.tenant_id] = Math.max(invoiceTotalByTenant[inv.tenant_id] || 0, Number(inv.total_due) || 0);
      }
      const paidByTenant: Record<string, number> = {};
      for (const p of payments) {
        const t = tenantByInvoice[p.invoice_id];
        if (t) paidByTenant[t] = (paidByTenant[t] || 0) + (Number(p.amount_paid) || 0);
      }

      const built: Row[] = [];
      for (const t of (tenantsRes.data || []) as any[]) {
        const unit: any = Array.isArray(t.units) ? t.units[0] : t.units;
        const property: any = unit ? (Array.isArray(unit.properties) ? unit.properties[0] : unit.properties) : null;
        const invoiced = invoiceTotalByTenant[t.id] !== undefined;
        const baseRent = Number(unit?.base_rent) || 0;
        const expectedWithoutInvoice = isCurrent && t.status === "active" && unit && unit.status === "occupied" && baseRent > 0;
        if (!invoiced && !expectedWithoutInvoice) continue;
        const billed = isCurrent ? Math.max(baseRent, invoiceTotalByTenant[t.id] || 0) : invoiceTotalByTenant[t.id] || 0;
        const paid = paidByTenant[t.id] || 0;
        const balance = Math.max(billed - paid, 0);
        built.push({
          tenantId: t.id,
          tenant: t.full_name || "Unknown tenant",
          property: property?.property_name || "—",
          unit: unit?.unit_number || "—",
          billed,
          paid,
          balance,
          status: billed > 0 && paid >= billed ? "Paid" : paid > 0 ? "Partial" : "Unpaid",
        });
      }
      built.sort((a, b) => a.property.localeCompare(b.property) || a.unit.localeCompare(b.unit, undefined, { numeric: true }));

      const expenseRows: ExpenseRow[] = ((expensesRes.data || []) as any[]).map((e) => {
        const prop: any = Array.isArray(e.properties) ? e.properties[0] : e.properties;
        return { id: e.id, category: e.category || "other", description: e.description, amount: Number(e.amount) || 0, expense_date: e.expense_date, property: prop?.property_name || "General" };
      });

      setRows(built);
      setExpenses(expenseRows);
      setLoading(false);
    }
    load(landlordId);
    return () => {
      cancelled = true;
    };
  }, [landlordId, selected]);

  const billedTotal = rows.reduce((s, r) => s + r.billed, 0);
  const collectedTotal = rows.reduce((s, r) => s + r.paid, 0);
  const outstandingTotal = rows.reduce((s, r) => s + r.balance, 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const net = collectedTotal - expenseTotal;
  const rate = billedTotal > 0 ? Math.round((collectedTotal / billedTotal) * 100) : null;
  const expensesByCategory: Record<string, number> = {};
  for (const e of expenses) expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
  const period = options[selected].period;

  function badge(status: Row["status"]) {
    if (status === "Paid") return "bg-emerald-100 text-emerald-800";
    if (status === "Partial") return "bg-amber-100 text-amber-800";
    return "bg-rose-100 text-rose-800";
  }

  return (
    <main className="min-h-screen city-skyline-page">
      <header className="border-b bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">MANAGIKA HOMES</h1>
            <p className="text-sm text-slate-500">Property Management Made Simple</p>
          </div>
          <a href="/landlord/dashboard" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50">Dashboard</a>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Monthly Report</h2>
            <p className="mt-1 text-slate-500">{period} — what came in, who still owes, what was spent, and what is left.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <select value={selected} onChange={(e) => setSelected(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700">
              {options.map((o, i) => (
                <option key={o.period} value={i}>{o.period}</option>
              ))}
            </select>
            <button onClick={() => window.print()} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800">🖨 Print / Save as PDF</button>
          </div>
        </div>

        {error && <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
            <p className="text-sm font-medium text-slate-500">Rent due</p>
            <p className="mt-1 text-2xl font-bold">{loading ? "—" : money(billedTotal)}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm print:shadow-none">
            <p className="text-sm font-medium text-emerald-700">Collected</p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">{loading ? "—" : money(collectedTotal)}</p>
            <p className="text-sm text-emerald-600">{loading || rate === null ? "" : rate + "% of rent due"}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm print:shadow-none">
            <p className="text-sm font-medium text-amber-700">Still owed</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">{loading ? "—" : money(outstandingTotal)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
            <p className="text-sm font-medium text-slate-500">Left after expenses</p>
            <p className={"mt-1 text-2xl font-bold " + (net < 0 ? "text-rose-700" : "text-slate-900")}>{loading ? "—" : money(net)}</p>
            <p className="text-sm text-slate-400">{loading ? "" : "Collected " + money(collectedTotal) + " − spent " + money(expenseTotal)}</p>
          </div>
        </div>

        <div className="mb-6 overflow-hidden rounded-xl border bg-white shadow-sm print:shadow-none">
          <div className="border-b px-6 py-4">
            <h3 className="text-xl font-semibold">Rent by tenant</h3>
          </div>
          {loading ? (
            <p className="px-6 py-6 text-slate-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-6 py-6 text-slate-500">No rent was billed in {period}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Property</th>
                    <th className="px-4 py-3 font-semibold">Unit</th>
                    <th className="px-4 py-3 font-semibold">Tenant</th>
                    <th className="px-4 py-3 text-right font-semibold">Due</th>
                    <th className="px-4 py-3 text-right font-semibold">Paid</th>
                    <th className="px-4 py-3 text-right font-semibold">Balance</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.tenantId}>
                      <td className="px-4 py-3">{r.property}</td>
                      <td className="px-4 py-3">{r.unit}</td>
                      <td className="px-4 py-3 font-medium">{r.tenant}</td>
                      <td className="px-4 py-3 text-right">{money(r.billed)}</td>
                      <td className="px-4 py-3 text-right">{money(r.paid)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{money(r.balance)}</td>
                      <td className="px-4 py-3"><span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + badge(r.status)}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold">
                  <tr>
                    <td className="px-4 py-3" colSpan={3}>Total</td>
                    <td className="px-4 py-3 text-right">{money(billedTotal)}</td>
                    <td className="px-4 py-3 text-right">{money(collectedTotal)}</td>
                    <td className="px-4 py-3 text-right">{money(outstandingTotal)}</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div className="mb-6 overflow-hidden rounded-xl border bg-white shadow-sm print:shadow-none">
          <div className="border-b px-6 py-4">
            <h3 className="text-xl font-semibold">Expenses</h3>
          </div>
          {loading ? (
            <p className="px-6 py-6 text-slate-500">Loading…</p>
          ) : expenses.length === 0 ? (
            <p className="px-6 py-6 text-slate-500">No expenses were recorded in {period}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Details</th>
                    <th className="px-4 py-3 font-semibold">Property</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-3">{e.expense_date}</td>
                      <td className="px-4 py-3 capitalize">{e.category}</td>
                      <td className="px-4 py-3">{e.description || "—"}</td>
                      <td className="px-4 py-3">{e.property}</td>
                      <td className="px-4 py-3 text-right">{money(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold">
                  {Object.entries(expensesByCategory).map(([cat, total]) => (
                    <tr key={cat}>
                      <td className="px-4 py-2 font-normal text-slate-600" colSpan={4}>Total {cat}</td>
                      <td className="px-4 py-2 text-right font-normal text-slate-600">{money(total)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="px-4 py-3" colSpan={4}>Total expenses</td>
                    <td className="px-4 py-3 text-right">{money(expenseTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400">
          Generated by Managika Homes. &quot;Collected&quot; is rent paid towards {period}&apos;s invoices; expenses are those dated in {period}.
          {selected === 0 ? " For the current month, tenants in occupied units are counted at least at their base rent even if their invoice has not been created yet." : ""}
        </p>
      </section>
    </main>
  );
}
