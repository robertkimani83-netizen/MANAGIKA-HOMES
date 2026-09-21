"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// A reusable contact list so a landlord stops retyping the same plumber's
// number into the maintenance "technician" field every time. Vendors show
// up as an assignment option on the Maintenance page once one exists here.
export default function VendorsPage() {
  const router = useRouter();
  const [landlordId, setLandlordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<any[]>([]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/landlord/login"); return; }
      setLandlordId(data.user.id);
      await loadVendors(data.user.id);
      setLoading(false);
    }
    init();
  }, [router]);

  async function loadVendors(id: string) {
    const { data } = await supabase.from("vendors").select("id, name, phone, specialty, notes, created_at").eq("landlord_id", id).order("name", { ascending: true });
    setVendors(data || []);
  }

  async function addVendor() {
    if (!landlordId) return;
    if (!name.trim()) { setError("Enter a name."); return; }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("vendors").insert({
      landlord_id: landlordId,
      name: name.trim(),
      phone: phone.trim() || null,
      specialty: specialty.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setName(""); setPhone(""); setSpecialty(""); setNotes("");
    await loadVendors(landlordId);
  }

  async function deleteVendor(id: string) {
    if (!landlordId) return;
    if (!confirm("Delete this vendor? Past maintenance requests assigned to them will keep their history, just without a linked vendor.")) return;
    const { error: deleteError } = await supabase.from("vendors").delete().eq("id", id).eq("landlord_id", landlordId);
    if (deleteError) { alert("Could not delete this vendor: " + deleteError.message); return; }
    await loadVendors(landlordId);
  }

  if (loading) {
    return (<main className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500">Loading vendors...</main>);
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
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Vendors</h2>
        <p className="text-gray-500 mb-8">Your plumbers, electricians, and other contractors, saved once so you can assign them to a maintenance request in a couple of taps instead of retyping their number.</p>

        <div className="bg-white rounded-xl border shadow-sm p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4">Add a vendor</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Specialty</label>
              <input type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Plumbing, Electrical" className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Notes</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          <button onClick={addVendor} disabled={saving} className="mt-4 rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {saving ? "Saving..." : "Add vendor"}
          </button>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="text-xl font-semibold mb-4">Your vendors</h3>
          {vendors.length === 0 ? (
            <p className="text-gray-500">No vendors saved yet.</p>
          ) : (
            <div className="divide-y">
              {vendors.map((v) => (
                <div key={v.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">{v.name}{v.specialty ? " — " + v.specialty : ""}</p>
                    <p className="text-sm text-gray-500">{v.phone || "No phone on file"}{v.notes ? " · " + v.notes : ""}</p>
                  </div>
                  <button onClick={() => deleteVendor(v.id)} className="text-rose-600 hover:underline text-sm">Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
