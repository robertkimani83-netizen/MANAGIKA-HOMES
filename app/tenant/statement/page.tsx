"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { trPeriod, useTenantLang } from "@/lib/tenant-i18n";
import { loadStatement, type StatementEntry } from "@/lib/statement";
import StatementView from "../../StatementView";

// The tenant's own account statement: what they were charged and what they
// paid, with a running balance, ready to print or save as a PDF.
export default function TenantStatementPage() {
  const router = useRouter();
  const { lang, setLang, tr } = useTenantLang();
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<any>(null);
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user || (!data.user.email && !data.user.phone)) {
        router.push("/tenant/login");
        return;
      }
      // Row-level security already limits this to the signed-in tenant's own row.
      const { data: tenantRow } = await supabase.from("tenants").select("id, full_name, units(unit_number, properties(property_name))").maybeSingle();
      if (!tenantRow) {
        router.push("/tenant/login");
        return;
      }
      setTenant(tenantRow);
      const result = await loadStatement(tenantRow.id);
      if (result.error) setError(result.error);
      else setEntries(result.entries);
      setLoading(false);
    }
    init();
  }, [router]);

  if (loading || !tenant) {
    return <main className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500">{tr("Loading your account...")}</main>;
  }

  const unit = tenant.units ? (tenant.units.properties?.property_name ? tenant.units.properties.property_name + " — " : "") + tr("Unit") + " " + tenant.units.unit_number : "";

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-white border-b print:hidden">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MANAGIKA HOMES</h1>
            <p className="text-sm text-gray-500">{tr("Tenant Portal")}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 text-xs font-semibold">
              <button onClick={() => setLang("en")} className={"rounded-full px-3 py-1.5 " + (lang === "en" ? "bg-gray-900 text-white" : "border border-gray-300 bg-white text-gray-600")}>English</button>
              <button onClick={() => setLang("sw")} className={"rounded-full px-3 py-1.5 " + (lang === "sw" ? "bg-gray-900 text-white" : "border border-gray-300 bg-white text-gray-600")}>Kiswahili</button>
            </div>
            <a href="/tenant/dashboard" className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700">{tr("← Back to My Account")}</a>
          </div>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-8">
        {error && <p className="mb-6 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>}
        <StatementView tenantName={tenant.full_name} unitLabel={unit} entries={entries} tr={tr} formatPeriod={(p) => trPeriod(lang, p)} />
      </section>
    </main>
  );
}
