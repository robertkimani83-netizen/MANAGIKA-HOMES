"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const DEFAULT_TERMS = `1. The tenant agrees to pay rent in full by the 5th of each month.
2. The tenant will keep the unit and common areas clean and undamaged.
3. Any maintenance issues will be reported through Managika Homes promptly.
4. The tenant will not sublet the unit without the landlord's written consent.
5. Either party may end this agreement with 30 days' written notice.
6. The security deposit is refundable at move-out, subject to the unit's condition (see move-in/move-out inspection records).

Edit this to match your own lease terms before sending it to your tenant.`;

// Lightweight digital lease + acceptance - NOT a certified e-signature
// service (see the lease_agreements migration comment). It's a typed-
// name-plus-timestamp acceptance record: a real step up from nothing, but
// should not be presented to tenants as legally equivalent to a notarized
// or cryptographically-signed lease.
export default function LeasesPage() {
  const router = useRouter();
  const [landlordId, setLandlordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]);

  const [tenantId, setTenantId] = useState("");
  const [selectedUnitId, setUnitIdForSelectedTenant] = useState<string | null>(null);
  const [termsText, setTermsText] = useState(DEFAULT_TERMS);
  const [monthlyRent, setMonthlyRent] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/landlord/login"); return; }
      setLandlordId(data.user.id);

      const { data: tenantRows } = await supabase.from("tenants").select("id, full_name, unit_id, units(unit_number, base_rent)").eq("landlord_id", data.user.id).order("full_name", { ascending: true });
      setTenants(tenantRows || []);

      await loadLeases(data.user.id);
      setLoading(false);
    }
    init();
  }, [router]);

  async function loadLeases(id: string) {
    const { data } = await supabase.from("lease_agreements").select("id, tenant_id, monthly_rent, start_date, end_date, status, accepted_full_name, accepted_at, created_at, tenants(full_name)").eq("landlord_id", id).order("created_at", { ascending: false });
    setLeases(data || []);
  }

  function onTenantChange(id: string) {
    setTenantId(id);
    const t = tenants.find((x) => x.id === id);
    if (t?.units?.base_rent) setMonthlyRent(String(t.units.base_rent));
    if (t?.unit_id) setUnitIdForSelectedTenant(t.unit_id);
  }

  async function createLease() {
    if (!landlordId) return;
    if (!tenantId) { setError("Select a tenant."); return; }
    if (!termsText.trim()) { setError("Lease terms can't be empty."); return; }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("lease_agreements").insert({
      landlord_id: landlordId,
      tenant_id: tenantId,
      unit_id: selectedUnitId || null,
      terms_text: termsText.trim(),
      monthly_rent: monthlyRent ? Number(monthlyRent) : null,
      start_date: startDate || null,
      end_date: endDate || null,
      status: "sent",
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setTenantId(""); setMonthlyRent(""); setStartDate(""); setEndDate(""); setTermsText(DEFAULT_TERMS);
    await loadLeases(landlordId);
  }

  if (loading) {
    return (<main className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500">Loading leases...</main>);
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
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Leases</h2>
        <p className="text-gray-500 mb-8">A digital copy of the lease terms your tenant can review and accept in their portal. This is a typed-name acceptance record, not a certified e-signature - keep your signed paper lease as the legal document, this is a convenient, timestamped backup of &quot;they saw and agreed to these terms.&quot;</p>

        <div className="bg-white rounded-xl border shadow-sm p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4">Create a lease</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="sm:col-span-3">
              <label className="mb-2 block text-sm font-medium text-gray-700">Tenant</label>
              <select value={tenantId} onChange={(e) => onTenantChange(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
                <option value="">Select tenant</option>
                {tenants.map((t) => (<option key={t.id} value={t.id}>{t.full_name}{t.units ? " — Unit " + t.units.unit_number : ""}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Monthly rent (KSh)</label>
              <input type="number" min="0" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
          </div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Lease terms</label>
          <textarea value={termsText} onChange={(e) => setTermsText(e.target.value)} rows={10} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 font-mono text-sm" />
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          <button onClick={createLease} disabled={saving} className="mt-4 rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {saving ? "Sending..." : "Send to tenant"}
          </button>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="text-xl font-semibold mb-4">Sent leases</h3>
          {leases.length === 0 ? (
            <p className="text-gray-500">No leases sent yet.</p>
          ) : (
            <div className="divide-y">
              {leases.map((l) => (
                <div key={l.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">{l.tenants?.full_name || "Unknown tenant"}</p>
                    <p className="text-sm text-gray-500">
                      {l.monthly_rent ? "KSh " + Number(l.monthly_rent).toLocaleString() + "/mo · " : ""}
                      {l.start_date || "?"} to {l.end_date || "?"}
                    </p>
                  </div>
                  {l.status === "accepted" ? (
                    <span className="text-sm font-medium text-emerald-700">Accepted {l.accepted_at ? new Date(l.accepted_at).toLocaleDateString() : ""}</span>
                  ) : (
                    <span className="text-sm font-medium text-amber-700">Awaiting acceptance</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
