"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { normalizePhone } from "@/lib/tenant-phone";
import { ARREARS_BUCKETS, loadArrears, summarize, type ArrearsBucketKey, type ArrearsRow } from "@/lib/arrears";
import { downloadCsv, todayForFileName } from "@/lib/csv";

const TILE_CLASS: Record<ArrearsBucketKey, string> = {
  current: "border-amber-200 bg-amber-50 text-amber-900",
  one: "border-orange-200 bg-orange-50 text-orange-900",
  two: "border-rose-200 bg-rose-50 text-rose-900",
  three: "border-red-300 bg-red-50 text-red-900",
};

const BADGE_CLASS: Record<ArrearsBucketKey, string> = {
  current: "bg-amber-100 text-amber-800",
  one: "bg-orange-100 text-orange-800",
  two: "bg-rose-100 text-rose-800",
  three: "bg-red-100 text-red-800",
};

function kes(amount: number) {
  return "KSh " + Math.round(amount).toLocaleString("en-US");
}

export default function ArrearsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ArrearsRow[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<ArrearsBucketKey | "all">("all");

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/landlord/login");
        return;
      }
      const result = await loadArrears(data.user.id);
      if (result.error) setError("Late rent could not be loaded (" + result.error + "). Please refresh the page.");
      else setRows(result.rows);
      setLoading(false);
    }
    init();
  }, [router]);

  const summary = summarize(rows);
  const totalOwed = rows.reduce((sum, r) => sum + r.balance, 0);
  const shown = filter === "all" ? rows : rows.filter((r) => r.bucket === filter);

  function exportCsv() {
    downloadCsv(
      "managika-late-rent-" + todayForFileName() + ".csv",
      ["Tenant", "Property", "Unit", "Phone", "Balance (KSh)", "Oldest unpaid month", "Months late", "Unpaid invoices"],
      shown.map((r) => [r.name, r.property, r.unit, r.phone, r.balance, r.oldestPeriod, r.monthsLate, r.unpaidInvoices])
    );
  }

  function whatsappLink(r: ArrearsRow) {
    const phone = normalizePhone(r.phone);
    if (!phone) return null;
    const message = "Hello " + r.name + ", a friendly reminder that your rent balance for Unit " + r.unit + " is " + kes(r.balance) + ". Thank you.";
    return "https://wa.me/" + phone.replace(/\D/g, "") + "?text=" + encodeURIComponent(message);
  }

  return (
    <main className="min-h-screen city-skyline-page">
      <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400" />
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">MANAGIKA HOMES</h1>
            <p className="text-sm text-slate-500">Property Management Made Simple</p>
          </div>
          <a href="/landlord/dashboard" className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700">Dashboard</a>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-3xl">⏳</span>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Late Rent</h2>
              <p className="text-slate-500 mt-1">Who owes rent, and for how long. The longest overdue are at the top.</p>
            </div>
          </div>
          <button onClick={exportCsv} disabled={loading || shown.length === 0} className="rounded-lg border-2 border-slate-900 bg-white px-5 py-3 font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-40">⬇ Download CSV</button>
        </div>

        {error && <p className="mb-6 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>}

        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {ARREARS_BUCKETS.map((bucket) => (
            <button
              key={bucket.key}
              onClick={() => setFilter(filter === bucket.key ? "all" : bucket.key)}
              className={"rounded-2xl border p-5 text-left shadow-sm transition " + TILE_CLASS[bucket.key] + (filter === bucket.key ? " ring-2 ring-slate-900" : "")}
            >
              <p className="text-sm font-medium">{bucket.label}</p>
              <p className="mt-2 text-2xl font-bold">{loading ? "—" : kes(summary[bucket.key].amount)}</p>
              <p className="mt-1 text-sm opacity-80">{loading ? "" : summary[bucket.key].count + " tenant" + (summary[bucket.key].count === 1 ? "" : "s")}</p>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-semibold">
              {filter === "all" ? "Everyone who owes" : ARREARS_BUCKETS.find((b) => b.key === filter)?.label}
              {!loading && <span className="ml-2 text-base font-normal text-slate-500">({shown.length}{filter === "all" ? " · " + kes(totalOwed) + " in total" : ""})</span>}
            </h3>
            {filter !== "all" && <button onClick={() => setFilter("all")} className="text-sm font-medium text-slate-700 hover:underline">Show everyone</button>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Tenant</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Unit</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Owes</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Since</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">Loading...</td></tr>
                ) : shown.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">{rows.length === 0 ? "Nobody owes rent right now. 🎉" : "Nobody in this group."}</td></tr>
                ) : (
                  shown.map((r) => {
                    const link = whatsappLink(r);
                    return (
                      <tr key={r.tenantId} className="border-t align-top">
                        <td className="px-6 py-4">
                          <a href={"/tenants/" + r.tenantId} className="font-medium text-amber-600 hover:underline">{r.name}</a>
                          {r.phone && <p className="text-xs text-slate-500">{r.phone}</p>}
                        </td>
                        <td className="px-6 py-4">{r.unit || "—"}{r.property && <p className="text-xs text-slate-500">{r.property}</p>}</td>
                        <td className="px-6 py-4 font-semibold">{kes(r.balance)}{r.unpaidInvoices > 1 && <p className="text-xs font-normal text-slate-500">{r.unpaidInvoices} unpaid months</p>}</td>
                        <td className="px-6 py-4">
                          <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + BADGE_CLASS[r.bucket]}>{ARREARS_BUCKETS.find((b) => b.key === r.bucket)?.label}</span>
                          <p className="mt-1 text-xs text-slate-500">from {r.oldestPeriod}</p>
                        </td>
                        <td className="px-6 py-4">
                          {link && <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">💬 WhatsApp</a>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <footer className="border-t bg-white mt-10">
        <div className="max-w-7xl mx-auto px-6 py-6 text-sm text-slate-500">© 2026 Managika Homes. Property management made simple.</div>
      </footer>
    </main>
  );
}
