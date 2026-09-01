"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Screening = {
  id: string;
  full_name: string;
  phone_number: string | null;
  id_number: string | null;
  employer: string | null;
  previous_landlord_name: string | null;
  previous_landlord_phone: string | null;
  notes: string | null;
  recommendation: string;
  converted_to_tenant: boolean;
  created_at: string;
};

const RECOMMENDATION_LABEL: Record<string, string> = {
  pending: "Not decided yet",
  proceed: "Proceed",
  caution: "Proceed with caution",
  decline: "Decline",
};

const RECOMMENDATION_COLOR: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  proceed: "bg-green-100 text-green-800",
  caution: "bg-amber-100 text-amber-800",
  decline: "bg-red-100 text-red-700",
};

export default function ScreeningPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [landlordId, setLandlordId] = useState<string | null>(null);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [employer, setEmployer] = useState("");
  const [prevLandlordName, setPrevLandlordName] = useState("");
  const [prevLandlordPhone, setPrevLandlordPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [recommendation, setRecommendation] = useState("pending");

  async function loadScreenings(id: string) {
    const { data } = await supabase.from("tenant_screenings").select("*").eq("landlord_id", id).order("created_at", { ascending: false });
    setScreenings((data as Screening[]) || []);
  }

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/landlord/login"); return; }
      setLandlordId(data.user.id);
      await loadScreenings(data.user.id);
      setLoading(false);
    }
    init();
  }, [router]);

  function resetForm() {
    setFullName(""); setPhoneNumber(""); setIdNumber(""); setEmployer("");
    setPrevLandlordName(""); setPrevLandlordPhone(""); setNotes(""); setRecommendation("pending");
  }

  async function addScreening() {
    setError(null);
    if (!landlordId) return;
    if (!fullName.trim()) { setError("Please enter the prospective tenant's name."); return; }
    setSaving(true);
    const { error: insertError } = await supabase.from("tenant_screenings").insert({
      landlord_id: landlordId,
      full_name: fullName.trim(),
      phone_number: phoneNumber.trim() || null,
      id_number: idNumber.trim() || null,
      employer: employer.trim() || null,
      previous_landlord_name: prevLandlordName.trim() || null,
      previous_landlord_phone: prevLandlordPhone.trim() || null,
      notes: notes.trim() || null,
      recommendation,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    resetForm();
    setShowForm(false);
    await loadScreenings(landlordId);
  }

  async function updateRecommendation(id: string, value: string) {
    await supabase.from("tenant_screenings").update({ recommendation: value }).eq("id", id).eq("landlord_id", landlordId);
    if (landlordId) await loadScreenings(landlordId);
  }

  async function markConverted(id: string) {
    await supabase.from("tenant_screenings").update({ converted_to_tenant: true }).eq("id", id).eq("landlord_id", landlordId);
    if (landlordId) await loadScreenings(landlordId);
  }

  async function deleteScreening(id: string) {
    if (!confirm("Delete this screening record?")) return;
    await supabase.from("tenant_screenings").delete().eq("id", id).eq("landlord_id", landlordId);
    if (landlordId) await loadScreenings(landlordId);
  }

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <a href="/landlord/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-900">&larr; Back to Dashboard</a>

        <div className="mt-4 mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tenant Screening</h1>
            <p className="mt-1 text-sm text-slate-500">
              Log what you already check before renting to someone new &mdash; ID, employer, a previous landlord&rsquo;s reference &mdash; in one place instead of scattered notes. This is your own record; prospective tenants never see it.
            </p>
          </div>
          <button onClick={() => setShowForm((v) => !v)} className="shrink-0 rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-slate-900 hover:bg-amber-400">
            {showForm ? "Cancel" : "+ New Screening"}
          </button>
        </div>

        {showForm && (
          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Full Name</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Phone Number</label>
                <input type="text" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="0712345678" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">National ID Number</label>
                <input type="text" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Employer</label>
                <input type="text" value={employer} onChange={(e) => setEmployer(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Previous Landlord Name</label>
                <input type="text" value={prevLandlordName} onChange={(e) => setPrevLandlordName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Previous Landlord Phone</label>
                <input type="text" value={prevLandlordPhone} onChange={(e) => setPrevLandlordPhone(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="What did the previous landlord say? Anything else worth remembering?" className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Your Recommendation</label>
              <select value={recommendation} onChange={(e) => setRecommendation(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200">
                <option value="pending">Not decided yet</option>
                <option value="proceed">Proceed</option>
                <option value="caution">Proceed with caution</option>
                <option value="decline">Decline</option>
              </select>
            </div>
            <button type="button" disabled={saving} onClick={addScreening} className="mt-5 rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
              {saving ? "Saving..." : "Save Screening"}
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : screenings.length === 0 ? (
          <p className="text-sm text-slate-500">No screenings logged yet.</p>
        ) : (
          <div className="space-y-3">
            {screenings.map((s) => (
              <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {s.full_name}
                      {s.converted_to_tenant && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Added as tenant</span>}
                    </p>
                    <p className="text-sm text-slate-500">
                      {[s.phone_number, s.id_number && "ID " + s.id_number, s.employer].filter(Boolean).join(" · ") || "No details on file"}
                    </p>
                    {(s.previous_landlord_name || s.previous_landlord_phone) && (
                      <p className="mt-1 text-sm text-slate-500">Previous landlord: {[s.previous_landlord_name, s.previous_landlord_phone].filter(Boolean).join(" · ")}</p>
                    )}
                    {s.notes && <p className="mt-2 text-sm text-slate-700">{s.notes}</p>}
                  </div>
                  <select
                    value={s.recommendation}
                    onChange={(e) => updateRecommendation(s.id, e.target.value)}
                    className={"shrink-0 rounded-full px-3 py-1 text-xs font-semibold " + (RECOMMENDATION_COLOR[s.recommendation] || "bg-slate-100 text-slate-600")}
                  >
                    <option value="pending">{RECOMMENDATION_LABEL.pending}</option>
                    <option value="proceed">{RECOMMENDATION_LABEL.proceed}</option>
                    <option value="caution">{RECOMMENDATION_LABEL.caution}</option>
                    <option value="decline">{RECOMMENDATION_LABEL.decline}</option>
                  </select>
                </div>
                <div className="mt-3 flex gap-4">
                  {!s.converted_to_tenant && (
                    <button onClick={() => markConverted(s.id)} className="text-sm font-medium text-emerald-700 hover:underline">
                      Mark as added to Tenants
                    </button>
                  )}
                  <button onClick={() => deleteScreening(s.id)} className="text-sm font-medium text-red-600 hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
