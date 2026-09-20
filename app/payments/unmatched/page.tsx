"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Entry = {
  id: string;
  created_at: string;
  reason: string;
  amount: number | null;
  house_tag: string | null;
  payer_name: string | null;
  mpesa_ref: string | null;
  message_text: string | null;
  resolved: boolean;
};

const REASON_LABELS: Record<string, string> = {
  message_not_parseable: "Message format not recognised",
  no_matching_unit: "House tag didn't match any unit",
  ambiguous_unit: "House tag matched more than one unit",
  no_active_tenant_for_unit: "No tenant on that unit",
  multiple_tenants_for_unit: "More than one tenant on that unit",
  invoice_create_failed: "Could not create the invoice",
  bad_payload: "Forwarded message was unreadable",
  invoice_status_update_failed: "Payment saved, but the invoice status did not update",
};

function reasonLabel(reason: string) {
  if (reason.startsWith("internal_error")) return "Something went wrong recording it (" + reason.replace("internal_error: ", "") + ")";
  return REASON_LABELS[reason] || reason;
}

export default function UnmatchedSmsPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [token, setToken] = useState("");

  async function load(accessToken: string, all: boolean) {
    setLoading(true);
    setError("");
    const res = await fetch("/api/landlord/sms-payment-log" + (all ? "?all=1" : ""), { headers: { Authorization: "Bearer " + accessToken } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(res.status === 404 ? "This page isn't available for your account." : data.error || "Could not load the list.");
      setEntries([]);
    } else {
      setEntries(data.entries || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token || "";
      if (!accessToken) { router.push("/landlord/login"); return; }
      setToken(accessToken);
      await load(accessToken, false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setResolved(id: string, resolved: boolean) {
    const res = await fetch("/api/landlord/sms-payment-log", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ id, resolved }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not update that entry. Has the database update been run?");
      return;
    }
    await load(token, showResolved);
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MANAGIKA HOMES</h1>
            <p className="text-sm text-gray-500">Property Management Made Simple</p>
          </div>
          <a href="/payments" className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700">Payments</a>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Unmatched bank SMS</h2>
            <p className="text-gray-500 mt-1">Bank messages that came in but could not be matched to a tenant automatically. Record the payment by hand on the Payments page, then mark it done here.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => { setShowResolved(e.target.checked); load(token, e.target.checked); }}
            />
            Show handled ones too
          </label>
        </div>

        {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{error}</div>}

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : entries.length === 0 && !error ? (
          <div className="rounded-xl border bg-white p-8 text-center text-gray-500">Nothing to look at - every bank SMS was matched automatically.</div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className={"rounded-xl border bg-white p-5 shadow-sm " + (entry.resolved ? "opacity-60" : "")}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {entry.amount != null ? "KSh " + Number(entry.amount).toLocaleString() : "Amount unknown"}
                      {entry.house_tag ? " - #" + entry.house_tag : ""}
                      {entry.payer_name ? " - " + entry.payer_name : ""}
                    </p>
                    <p className="text-sm text-amber-700 mt-1">{reasonLabel(entry.reason)}</p>
                    {entry.mpesa_ref && <p className="text-sm text-gray-500 mt-1">M-Pesa ref: {entry.mpesa_ref}</p>}
                    <p className="text-xs text-gray-400 mt-1">{new Date(entry.created_at).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => setResolved(entry.id, !entry.resolved)}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {entry.resolved ? "Mark not handled" : "Mark as handled"}
                  </button>
                </div>
                {entry.message_text && (
                  <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 break-words">{entry.message_text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
