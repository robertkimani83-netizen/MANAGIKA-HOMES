"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type EndingLease = { id: string; name: string; unit: string; property: string; endDate: string; daysLeft: number };

const WINDOW_DAYS = 60;

function localIso(date: Date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

// "2026-11-30" as that calendar day at local midnight (not shifted by time zone).
function dayFromIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function whenText(daysLeft: number) {
  if (daysLeft === 0) return "ends today";
  if (daysLeft === 1) return "ends tomorrow";
  if (daysLeft > 1) return "ends in " + daysLeft + " days";
  if (daysLeft === -1) return "ended yesterday";
  return "ended " + Math.abs(daysLeft) + " days ago";
}

// Dashboard card: leases that finish in the next 60 days (or finished in the
// last 60), so a lease never runs out without anyone noticing. The dates come
// from the Lease section on each tenant's page. Renders nothing when there
// is nothing to show.
export default function LeasesEndingCard() {
  const [leases, setLeases] = useState<EndingLease[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const from = new Date(today);
      from.setDate(from.getDate() - WINDOW_DAYS);
      const to = new Date(today);
      to.setDate(to.getDate() + WINDOW_DAYS);

      const { data, error } = await supabase
        .from("tenants")
        .select("id, full_name, lease_end_date, units(unit_number, properties(property_name))")
        .eq("landlord_id", userData.user.id)
        .eq("status", "active")
        .gte("lease_end_date", localIso(from))
        .lte("lease_end_date", localIso(to))
        .order("lease_end_date", { ascending: true });
      if (cancelled || error || !data) return;

      setLeases(
        (data as any[]).map((t) => ({
          id: t.id,
          name: t.full_name || "Unknown tenant",
          unit: t.units?.unit_number || "",
          property: t.units?.properties?.property_name || "",
          endDate: t.lease_end_date,
          daysLeft: Math.round((dayFromIso(t.lease_end_date).getTime() - today.getTime()) / 86400000),
        }))
      );
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (leases.length === 0) return null;
  const shown = leases.slice(0, 6);

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-bold text-slate-900">📄 Leases ending soon</h3>
      <p className="text-sm text-slate-500">Leases that end in the next {WINDOW_DAYS} days, or ended in the last {WINDOW_DAYS}. Open a tenant to renew or change the dates.</p>
      <div className="mt-5 space-y-3">
        {shown.map((l) => (
          <div key={l.id} className={"flex items-center justify-between gap-3 rounded-xl border px-5 py-4 " + (l.daysLeft < 0 ? "border-red-200 bg-red-50" : l.daysLeft <= 30 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50")}>
            <div>
              <p className="font-semibold text-slate-900">{l.name}{l.unit && " — Unit " + l.unit}</p>
              <p className="text-sm text-slate-600">{l.property && l.property + " · "}Lease {whenText(l.daysLeft)} ({l.endDate})</p>
            </div>
            <a href={"/tenants/" + l.id} className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Open</a>
          </div>
        ))}
        {leases.length > shown.length && <p className="text-sm text-slate-500">+ {leases.length - shown.length} more — open the Tenants page to see them.</p>}
      </div>
    </div>
  );
}
