"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { WeeklySummary } from "@/lib/weekly-summary";

function kes(n: number) {
  return "KSh " + Math.round(n).toLocaleString("en-US");
}

// "This week" card on the landlord dashboard: money in over the last 7 days,
// who still owes, repairs and vacancies - plus a button to share it on
// WhatsApp (works today, no SMS sender name needed).
export default function WeeklySummaryCard() {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const res = await fetch("/api/landlord/weekly-summary", { headers: { Authorization: "Bearer " + data.session.access_token } });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.summary) {
          setFailed(true);
          return;
        }
        setSummary(json.summary);
        setMessage(json.message || "");
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return null;

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Your week</h3>
          <p className="text-sm text-slate-500">The last 7 days at a glance</p>
        </div>
        {summary && message && (
          <a
            href={"https://wa.me/?text=" + encodeURIComponent(message)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            💬 Share on WhatsApp
          </a>
        )}
      </div>
      {!summary ? (
        <p className="mt-4 text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Money in</p>
              <p className="mt-1 text-xl font-bold text-emerald-900">{kes(summary.receivedAmount)}</p>
              <p className="text-xs text-emerald-600">{summary.receivedCount} payment{summary.receivedCount === 1 ? "" : "s"}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Still owed</p>
              <p className="mt-1 text-xl font-bold text-amber-900">{kes(summary.owingAmount)}</p>
              <p className="text-xs text-amber-600">{summary.owingCount} tenant{summary.owingCount === 1 ? "" : "s"}</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Open repairs</p>
              <p className="mt-1 text-xl font-bold text-rose-900">{summary.openRepairs}</p>
              <p className="text-xs text-rose-600">{summary.urgentRepairs > 0 ? summary.urgentRepairs + " urgent" : "none urgent"}</p>
            </div>
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">Vacant units</p>
              <p className="mt-1 text-xl font-bold text-purple-900">{summary.vacantUnits}</p>
              <p className="text-xs text-purple-600">of {summary.totalUnits}</p>
            </div>
          </div>
          {summary.topOwing.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-slate-700">Biggest balances</p>
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {summary.topOwing.map((o, i) => (
                  <li key={i} className="flex items-center justify-between py-2">
                    <span className="text-slate-700">{o.name} · Unit {o.unit}</span>
                    <span className="font-semibold text-amber-800">{kes(o.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
