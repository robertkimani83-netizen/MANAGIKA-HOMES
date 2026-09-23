"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ARREARS_BUCKETS, loadArrears, summarize, type ArrearsBucketKey, type ArrearsRow } from "@/lib/arrears";

const TILE_CLASS: Record<ArrearsBucketKey, string> = {
  current: "border-amber-200 bg-amber-50 text-amber-900",
  one: "border-orange-200 bg-orange-50 text-orange-900",
  two: "border-rose-200 bg-rose-50 text-rose-900",
  three: "border-red-300 bg-red-50 text-red-900",
};

function kes(amount: number) {
  return "KSh " + Math.round(amount).toLocaleString("en-US");
}

// Dashboard card: how much rent is late and for how long, in four groups.
// It stays out of the way (renders nothing) when nobody owes or the numbers
// could not be loaded.
export default function LateRentCard() {
  const [rows, setRows] = useState<ArrearsRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const result = await loadArrears(data.user.id);
      if (!cancelled && !result.error) setRows(result.rows);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!rows || rows.length === 0) return null;
  const summary = summarize(rows);
  const total = rows.reduce((sum, r) => sum + r.balance, 0);

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-900">⏳ Late rent</h3>
          <p className="text-sm text-slate-500">{kes(total)} owed by {rows.length} tenant{rows.length === 1 ? "" : "s"}, grouped by how long it has been</p>
        </div>
        <a href="/arrears" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">See who owes</a>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ARREARS_BUCKETS.map((bucket) => (
          <a key={bucket.key} href="/arrears" className={"rounded-xl border p-4 " + TILE_CLASS[bucket.key]}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{bucket.label}</p>
            <p className="mt-1 text-lg font-bold">{kes(summary[bucket.key].amount)}</p>
            <p className="text-xs opacity-80">{summary[bucket.key].count} tenant{summary[bucket.key].count === 1 ? "" : "s"}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
