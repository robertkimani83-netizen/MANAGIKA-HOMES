"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Preventive maintenance: recurring tasks a landlord defines once ("service
// the generator every 6 months", "clean the water tank every 3 months")
// instead of only ever reacting to a tenant's complaint. A daily cron
// (maintenance-due) texts the landlord when one is coming up; "Mark done"
// here pushes the next due date forward by the same frequency.
function addMonths(dateStr: string, months: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export default function MaintenanceSchedulesPage() {
  const router = useRouter();
  const [landlordId, setLandlordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  const [unitId, setUnitId] = useState("");
  const [title, setTitle] = useState("");
  const [frequencyMonths, setFrequencyMonths] = useState("6");
  const [nextDueDate, setNextDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/landlord/login"); return; }
      setLandlordId(data.user.id);

      const { data: unitRows } = await supabase.from("units").select("id, unit_number, properties!inner(property_name, landlord_id)").eq("properties.landlord_id", data.user.id).order("unit_number", { ascending: true });
      setUnits(unitRows || []);

      await loadSchedules(data.user.id);
      setLoading(false);
    }
    init();
  }, [router]);

  async function loadSchedules(id: string) {
    const { data } = await supabase.from("maintenance_schedules").select("id, title, frequency_months, next_due_date, last_completed_at, notes, unit_id, units(unit_number, properties(property_name))").eq("landlord_id", id).order("next_due_date", { ascending: true });
    setSchedules(data || []);
  }

  async function addSchedule() {
    if (!landlordId) return;
    if (!title.trim()) { setError("Enter a title for this task."); return; }
    const freq = Number(frequencyMonths);
    if (!Number.isFinite(freq) || freq <= 0) { setError("Enter a valid frequency in months."); return; }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("maintenance_schedules").insert({
      landlord_id: landlordId,
      unit_id: unitId || null,
      title: title.trim(),
      frequency_months: freq,
      next_due_date: nextDueDate,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setTitle(""); setNotes("");
    await loadSchedules(landlordId);
  }

  async function markDone(s: any) {
    if (!landlordId) return;
    const today = new Date().toISOString().slice(0, 10);
    const newDueDate = addMonths(today, s.frequency_months);
    await supabase.from("maintenance_schedules").update({
      last_completed_at: today,
      next_due_date: newDueDate,
      last_reminded_at: null,
    }).eq("id", s.id).eq("landlord_id", landlordId);
    await loadSchedules(landlordId);
  }

  async function deleteSchedule(id: string) {
    if (!landlordId) return;
    if (!confirm("Delete this maintenance schedule?")) return;
    await supabase.from("maintenance_schedules").delete().eq("id", id).eq("landlord_id", landlordId);
    await loadSchedules(landlordId);
  }

  const today = new Date().toISOString().slice(0, 10);

  if (loading) {
    return (<main className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500">Loading maintenance schedules...</main>);
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
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Preventive Maintenance</h2>
        <p className="text-gray-500 mb-8">Recurring upkeep, separate from tenant-reported repairs on the <a href="/maintenance" className="underline">Maintenance</a> page. You&apos;ll get a text as each one comes due.</p>

        <div className="bg-white rounded-xl border shadow-sm p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4">Add a recurring task</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">Task</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Service the generator" className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Unit (optional - leave blank for a whole-property task)</label>
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
                <option value="">Whole property / general</option>
                {units.map((u) => (<option key={u.id} value={u.id}>{u.properties?.property_name} - {u.unit_number}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Repeat every (months)</label>
              <input type="number" min="1" value={frequencyMonths} onChange={(e) => setFrequencyMonths(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Next due date</label>
              <input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Notes (optional)</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          <button onClick={addSchedule} disabled={saving} className="mt-4 rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {saving ? "Saving..." : "Add task"}
          </button>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="text-xl font-semibold mb-4">Scheduled tasks</h3>
          {schedules.length === 0 ? (
            <p className="text-gray-500">No recurring tasks set up yet.</p>
          ) : (
            <div className="divide-y">
              {schedules.map((s) => {
                const overdue = s.next_due_date <= today;
                return (
                  <div key={s.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">{s.title}</p>
                      <p className="text-sm text-gray-500">
                        {s.units ? s.units.properties?.property_name + " - " + s.units.unit_number : "Whole property"} · every {s.frequency_months} month{s.frequency_months === 1 ? "" : "s"} ·{" "}
                        <span className={overdue ? "text-rose-600 font-medium" : ""}>Next due {s.next_due_date}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button onClick={() => markDone(s)} className="text-sm font-medium text-emerald-700 hover:underline">Mark done</button>
                      <button onClick={() => deleteSchedule(s.id)} className="text-sm text-rose-600 hover:underline">Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
