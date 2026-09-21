"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadStatement, type StatementEntry } from "@/lib/statement";
import StatementView from "../../../StatementView";

// One tenant's account statement for the landlord: charges, payments and the
// running balance, ready to print or save as a PDF (for example to settle an
// "I already paid" question, or when a tenant moves out).
export default function TenantStatementForLandlordPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<any>(null);
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/landlord/login");
        return;
      }
      // Only this landlord's own tenant (also enforced by the database).
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("id, full_name, units(unit_number, properties(property_name))")
        .eq("id", tenantId)
        .eq("landlord_id", data.user.id)
        .maybeSingle();
      if (!tenantRow) {
        setError("Tenant not found.");
        setLoading(false);
        return;
      }
      setTenant(tenantRow);
      const result = await loadStatement(tenantRow.id);
      if (result.error) setError(result.error);
      else setEntries(result.entries);
      setLoading(false);
    }
    init();
  }, [router, tenantId]);

  const unit = tenant?.units ? (tenant.units.properties?.property_name ? tenant.units.properties.property_name + " — " : "") + "Unit " + tenant.units.unit_number : "";

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-white border-b print:hidden">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MANAGIKA HOMES</h1>
            <p className="text-sm text-gray-500">Property Management Made Simple</p>
          </div>
          <a href={"/tenants/" + tenantId} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700">Back to Tenant</a>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-8">
        {error && <p className="mb-6 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>}
        {loading ? <p className="text-center text-gray-500">Loading statement...</p> : tenant && <StatementView tenantName={tenant.full_name} unitLabel={unit} entries={entries} />}
      </section>
    </main>
  );
}
