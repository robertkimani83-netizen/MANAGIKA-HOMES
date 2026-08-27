"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function InspectionPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [landlordId, setLandlordId] = useState<string | null>(null);
  const [tenant, setTenant] = useState<any>(null);

  const [type, setType] = useState<"move_in" | "move_out">("move_in");
  const [electricityReading, setElectricityReading] = useState("");
  const [waterReading, setWaterReading] = useState("");
  const [keysIssued, setKeysIssued] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositRefundAmount, setDepositRefundAmount] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/landlord/login"); return; }
      setLandlordId(data.user.id);

      // Scoped to this landlord's own tenant, same as the tenant detail page.
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("id, full_name, unit_id, landlord_id, units(unit_number, properties(property_name))")
        .eq("id", tenantId)
        .eq("landlord_id", data.user.id)
        .maybeSingle();
      if (!tenantRow) { router.push("/tenants"); return; }
      if (!tenantRow.unit_id) { setError("This tenant has no unit assigned - assign one before recording an inspection."); }
      setTenant(tenantRow);
      setLoading(false);
    }
    init();
  }, [router, tenantId]);

  async function authedFetch(url: string, options: RequestInit = {}) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token || "";
    const headers = new Headers(options.headers);
    headers.set("Authorization", "Bearer " + token);
    return fetch(url, { ...options, headers });
  }

  async function submitInspection() {
    if (!landlordId || !tenant?.unit_id) return;
    setSubmitting(true);
    setError(null);

    try {
      // Upload each photo through the same ownership-checked documents
      // endpoint used elsewhere, tagged document_type "inspection" - this
      // reuses that route's storage handling instead of a second copy of it.
      const photoDocumentIds: string[] = [];
      for (const file of photoFiles) {
        const form = new FormData();
        form.append("file", file);
        form.append("tenantId", tenantId);
        form.append("documentType", "inspection");
        const res = await authedFetch("/api/documents", { method: "POST", body: form });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Photo upload failed");
        photoDocumentIds.push(result.document.id);
      }

      const { error: insertError } = await supabase.from("unit_inspections").insert({
        landlord_id: landlordId,
        unit_id: tenant.unit_id,
        tenant_id: tenantId,
        type,
        electricity_meter_reading: electricityReading.trim() || null,
        water_meter_reading: waterReading.trim() || null,
        keys_issued: keysIssued ? Number(keysIssued) : null,
        condition_notes: conditionNotes.trim() || null,
        photo_document_ids: photoDocumentIds,
        deposit_amount: depositAmount ? Number(depositAmount) : null,
        deposit_refund_amount: depositRefundAmount ? Number(depositRefundAmount) : null,
        status: "completed",
      });
      if (insertError) throw new Error(insertError.message);

      router.push("/tenants/" + tenantId);
    } catch (e: any) {
      setError(e.message || "Failed to save inspection");
      setSubmitting(false);
    }
  }

  if (loading || !tenant) {
    return (<main className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500">Loading...</main>);
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MANAGIKA HOMES</h1>
            <p className="text-sm text-gray-500">Property Management Made Simple</p>
          </div>
          <a href={"/tenants/" + tenantId} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700">Back to Tenant</a>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Move-In / Move-Out Inspection</h2>
          <p className="text-gray-500 mt-1">{tenant.full_name}{tenant.units ? " — " + tenant.units.properties?.property_name + " Unit " + tenant.units.unit_number : ""}</p>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Inspection Type</label>
            <div className="flex gap-3">
              <button onClick={() => setType("move_in")} className={"flex-1 rounded-lg border px-4 py-3 font-medium " + (type === "move_in" ? "border-slate-900 bg-slate-900 text-white" : "border-gray-300 bg-white text-gray-700")}>Move-In</button>
              <button onClick={() => setType("move_out")} className={"flex-1 rounded-lg border px-4 py-3 font-medium " + (type === "move_out" ? "border-slate-900 bg-slate-900 text-white" : "border-gray-300 bg-white text-gray-700")}>Move-Out</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Electricity Meter Reading</label>
              <input value={electricityReading} onChange={(e) => setElectricityReading(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Water Meter Reading</label>
              <input value={waterReading} onChange={(e) => setWaterReading(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Keys Issued</label>
            <input type="number" min="0" value={keysIssued} onChange={(e) => setKeysIssued(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Condition Notes</label>
            <textarea value={conditionNotes} onChange={(e) => setConditionNotes(e.target.value)} rows={4} placeholder="Walls, fittings, appliances, any existing damage..." className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Photos</label>
            <input type="file" multiple accept="image/*" onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            {photoFiles.length > 0 && <p className="mt-2 text-sm text-gray-500">{photoFiles.length} photo{photoFiles.length > 1 ? "s" : ""} selected</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Deposit Amount {type === "move_in" ? "(collected)" : "(on file)"}</label>
              <input type="number" min="0" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            {type === "move_out" && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Deposit Refund Amount</label>
                <input type="number" min="0" value={depositRefundAmount} onChange={(e) => setDepositRefundAmount(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button onClick={submitInspection} disabled={submitting || !tenant.unit_id} className="w-full rounded-lg bg-blue-700 px-5 py-3 font-medium text-white hover:bg-blue-800 disabled:opacity-50">
            {submitting ? "Saving..." : "Save Inspection"}
          </button>
        </div>
      </section>

      <footer className="border-t bg-white mt-10">
        <div className="max-w-3xl mx-auto px-6 py-6 text-sm text-gray-500">© 2026 Managika Homes. Property management made simple.</div>
      </footer>
    </main>
  );
}
