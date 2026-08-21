"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Message = { role: "user" | "assistant"; text: string };

export default function TenantAiAssistantPage() {
const router = useRouter();
const [loading, setLoading] = useState(true);
const [dataSummary, setDataSummary] = useState("");
const [messages, setMessages] = useState<Message[]>([]);
const [question, setQuestion] = useState("");
const [asking, setAsking] = useState(false);

useEffect(() => {
async function init() {
  const { data } = await supabase.auth.getUser();
  if (!data.user || !data.user.email) { router.push("/tenant/login"); return; }

  const { data: tenantRowData } = await supabase.from("tenants").select("id, full_name, unit_id, units(unit_number, base_rent, properties(property_name))").eq("email", data.user.email).maybeSingle();
  if (!tenantRowData) { router.push("/tenant/login"); return; }
  const tenantRow: any = tenantRowData;

  const { data: invoices } = await supabase.from("invoices").select("billing_period, total_due, status, due_date").eq("tenant_id", tenantRow.id).order("due_date", { ascending: false });
  const { data: maintenance } = await supabase.from("maintenance_requests").select("title, urgency, status").eq("tenant_id", tenantRow.id).order("created_at", { ascending: false });
  const { data: complaints } = await supabase.from("complaints").select("description, status").eq("tenant_id", tenantRow.id).order("created_at", { ascending: false });

  const summary = [
    "Tenant name: " + tenantRow.full_name,
    "Property/unit: " + (tenantRow.units ? tenantRow.units.properties?.property_name + " - Unit " + tenantRow.units.unit_number : "no unit assigned yet"),
    "Monthly rent: " + (tenantRow.units ? "KSh " + Number(tenantRow.units.base_rent).toLocaleString() : "unknown"),
    "Invoices: " + ((invoices || []).length > 0 ? (invoices || []).map((i) => i.billing_period + " - KSh " + Number(i.total_due).toLocaleString() + " (" + i.status + ")").join("; ") : "none yet"),
    "Maintenance requests: " + ((maintenance || []).length > 0 ? (maintenance || []).map((m) => m.title + " (" + m.urgency + ", " + m.status + ")").join("; ") : "none"),
    "Complaints: " + ((complaints || []).length > 0 ? (complaints || []).map((c) => c.description + " (" + c.status + ")").join("; ") : "none"),
  ].join("\n");

  setDataSummary(summary);
  setLoading(false);
}
init();
}, [router]);

async function askQuestion() {
if (!question.trim()) return;
const q = question.trim();
setMessages((prev) => [...prev, { role: "user", text: q }]);
setQuestion("");
setAsking(true);
try {
  const res = await fetch("/api/ai-assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: q, context: dataSummary }),
  });
  const result = await res.json();
  if (!res.ok) {
    setMessages((prev) => [...prev, { role: "assistant", text: "Sorry, something went wrong: " + (result.error || "unknown error") }]);
  } else {
    setMessages((prev) => [...prev, { role: "assistant", text: result.answer }]);
  }
} catch (err: any) {
  setMessages((prev) => [...prev, { role: "assistant", text: "Sorry, something went wrong: " + err.message }]);
} finally {
  setAsking(false);
}
}

return (
<main className="min-h-screen bg-gray-100">
<header className="bg-white border-b">
<div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
<div>
<h1 className="text-2xl font-bold text-gray-900">MANAGIKA HOMES</h1>
<p className="text-sm text-gray-500">Tenant Portal</p>
</div>
<a href="/tenant/dashboard" className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700">Dashboard</a>
</div>
</header>

  <section className="max-w-3xl mx-auto px-6 py-8">
    <div className="mb-8">
      <h2 className="text-3xl font-bold text-gray-900">AI Assistant</h2>
      <p className="text-gray-500 mt-1">Ask about your rent, invoices, maintenance, or complaints.</p>
    </div>

    <div className="bg-white rounded-xl border shadow-sm">
      <div className="max-h-[50vh] min-h-[200px] overflow-y-auto p-6">
        {loading ? (
          <p className="text-gray-500">Loading your information...</p>
        ) : messages.length === 0 ? (
          <p className="text-gray-400">Try asking: "Have I paid rent this month?" or "What's the status of my maintenance request?"</p>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={m.role === "user" ? "max-w-[80%] rounded-2xl bg-black px-4 py-3 text-white" : "max-w-[80%] rounded-2xl bg-gray-100 px-4 py-3 text-gray-800"}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        )}
        {asking && <p className="mt-4 text-gray-400">Thinking...</p>}
      </div>
      <div className="flex gap-3 border-t p-4">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") askQuestion(); }}
          placeholder="Ask a question..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
        />
        <button onClick={askQuestion} disabled={asking || loading} className="rounded-lg bg-black px-5 py-3 font-medium text-white disabled:opacity-50">
          {asking ? "..." : "Ask"}
        </button>
      </div>
    </div>
  </section>

  <footer className="border-t bg-white mt-10">
    <div className="max-w-5xl mx-auto px-6 py-6 text-sm text-gray-500">© 2026 Managika Homes. Property management made simple.</div>
  </footer>
</main>

);
}
