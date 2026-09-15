"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const DEFAULT_TERMS = `RESIDENTIAL TENANCY AGREEMENT

1. PARTIES AND PREMISES
This Tenancy Agreement ("Agreement") is made between [LANDLORD FULL NAME] ("the Landlord") and the tenant named on this lease ("the Tenant"), regarding the residential unit shown above ("the Premises"), managed through Managika Homes.

2. TERM
This Agreement begins on the start date and ends on the end date shown above, unless renewed in writing or terminated earlier under the terms below.

3. RENT
3.1 The Tenant shall pay the monthly rent shown above, in full, by the 5th day of each calendar month.
3.2 Rent shall be paid using the payment method(s) the Landlord has set up through the Managika Homes app.
3.3 Late payment beyond 5 days may attract a late fee of [AMOUNT] or as otherwise communicated by the Landlord, and may result in a formal notice under Clause 9.

4. SECURITY DEPOSIT
4.1 The Tenant shall pay a security deposit of [AMOUNT], held by the Landlord for the duration of the tenancy.
4.2 The deposit is refundable within 30 days of move-out, less any deductions for unpaid rent, unpaid utility bills, or damage beyond normal wear and tear, as documented in the move-in and move-out inspection records.
4.3 The deposit shall not be treated as the final month's rent unless both parties agree in writing.

5. UTILITIES AND SERVICE CHARGES
5.1 Water and garbage collection charges are billed according to the rate and billing type set for this unit.
5.2 Electricity is billed and paid separately by the Tenant directly to the utility provider or token vendor, unless otherwise agreed.
5.3 The Tenant is responsible for promptly reporting any suspected meter faults or billing discrepancies.

6. USE OF THE PREMISES
6.1 The Premises shall be used solely as a private residence for the Tenant and any household members declared to the Landlord.
6.2 The Tenant shall not use the Premises for any illegal purpose, or in a way that disturbs neighbours or violates any estate or building rules.
6.3 The Tenant shall not sublet, assign, or allow any other person to occupy the Premises without the Landlord's prior written consent.

7. MAINTENANCE AND REPAIRS
7.1 The Tenant shall keep the Premises and any fittings, fixtures, and appliances provided in clean and good condition, and report any maintenance issue through Managika Homes promptly.
7.2 The Landlord is responsible for repairs to structural elements, plumbing, electrical wiring, and fixtures provided, except where damage is caused by the Tenant's negligence or misuse.
7.3 The Tenant shall not carry out any alterations, renovations, or fixed installations without the Landlord's prior written consent.
7.4 Any preventive maintenance scheduled by the Landlord (e.g. servicing shared equipment) will be communicated in advance where reasonably possible.

8. ACCESS AND INSPECTION
8.1 The Landlord, or an authorized representative, may enter the Premises for inspection, maintenance, or emergency purposes, giving the Tenant at least 24 hours' notice except in genuine emergencies.
8.2 The Tenant shall not unreasonably refuse access for legitimate purposes under this clause.

9. DEFAULT AND TERMINATION
9.1 Either party may terminate this Agreement by giving the other at least 30 days' written notice, unless a different notice period is agreed in writing.
9.2 The Landlord may terminate this Agreement with shorter notice, or immediately, in cases of: non-payment of rent for more than 30 days after the due date, illegal activity on the Premises, serious damage to the Premises, or repeated breach of this Agreement after a written warning.
9.3 On termination or expiry, the Tenant shall vacate the Premises, return all keys, and leave the unit in the condition recorded at move-in (fair wear and tear excepted), subject to a move-out inspection.

10. RENEWAL
10.1 Either party wishing not to renew this Agreement at the end of its term should notify the other in writing at least 30 days before the end date.
10.2 Managika Homes will remind the Landlord as the lease end date approaches; the Landlord is responsible for communicating any rent changes or new terms ahead of renewal.

11. INSURANCE AND LIABILITY
11.1 The Tenant is encouraged to obtain their own insurance for personal belongings; the Landlord is not liable for loss or damage to the Tenant's property except where caused by the Landlord's negligence.

12. DISPUTE RESOLUTION
12.1 The parties shall first attempt to resolve any dispute arising from this Agreement amicably, through direct discussion or via Managika Homes' complaint/communication tools.
12.2 If unresolved, either party may refer the matter to mediation or the appropriate courts of Kenya.

13. GOVERNING LAW
13.1 This Agreement is governed by the laws of the Republic of Kenya, including the applicable provisions of the landlord and tenant legislation in force.

14. ENTIRE AGREEMENT
14.1 This document, together with any move-in inspection record, constitutes the entire agreement between the parties regarding the Premises, and supersedes any prior verbal or written agreement, unless a formally signed paper lease between the parties says otherwise.

15. ACKNOWLEDGEMENT
By signing below, the Tenant confirms they have read, understood, and agree to be bound by all the terms of this Agreement.

---
Edit this template to match your own terms (fill in the bracketed amounts, add estate-specific rules, etc.) before sending it to your tenant. This copy is signed electronically in-app - keep your original signed paper lease, if any, as your primary legal record.`;

// Digital lease + e-sign: the tenant draws a signature (not just a typed
// name), and acceptance also records their IP address, device, and a
// SHA-256 fingerprint of the exact terms they saw (see
// app/api/tenant/lease/route.ts and lib/lease-pdf.ts for the signed PDF
// this produces). Still NOT a certified e-signature service - no identity
// verification like DocuSign performs - so this should be treated as
// strong supporting evidence of consent, not a replacement for a properly
// signed paper lease where one exists.
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

  async function downloadLeasePdf(leaseId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    try {
      const res = await fetch(`/api/leases/${leaseId}/pdf`, { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) { alert("Could not generate the PDF - please try again."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "managika-lease-agreement.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not generate the PDF - please try again.");
    }
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
        <p className="text-gray-500 mb-8">A detailed lease your tenant reviews and e-signs (drawn signature, IP address, device, and timestamp all recorded) in their portal. This is a strong, self-issued signing record, not a certified e-signature like DocuSign - keep your signed paper lease as the primary legal document if you have one, and use the &quot;Download PDF&quot; button below for a signed copy of this one.</p>

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
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-emerald-700">Accepted {l.accepted_at ? new Date(l.accepted_at).toLocaleDateString() : ""}</span>
                      <button onClick={() => downloadLeasePdf(l.id)} className="text-sm font-medium text-slate-700 underline hover:text-slate-900">Download PDF</button>
                    </div>
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
