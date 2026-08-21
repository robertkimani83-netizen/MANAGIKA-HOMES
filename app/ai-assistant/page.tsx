"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function currentPeriod() {
const d = new Date();
const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
return names[d.getMonth()] + " " + d.getFullYear();
}

type Message = { role: "user" | "assistant"; text: string };

export default function LandlordAiAssistantPage() {
const router = useRouter();
const [loading, setLoading] = useState(true);
const [dataSummary, setDataSummary] = useState("");
const [messages, setMessages] = useState<Message[]>([]);
const [question, setQuestion] = useState("");
const [asking, setAsking] = useState(false);

useEffect(() => {
async function init() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) { router.push("/landlord/login"); return; }
  await loadSummary(data.user.id);
  setLoading(false);
}
init();
}, [router]);

async function loadSummary(landlordId: string) {
const period = currentPeriod();

const { data: properties } = await supabase.from("properties").select("id, property_name").eq("landlord_id", landlordId);
const propertyIds = (properties || []).map((p) => p.id);

let units: { id: string; unit_number: string; base_rent: number; status: string }[] = [];
if (propertyIds.length > 0) {
  const { data: unitRows } = await supabase.from("units").select("id, unit_number, base_rent, status").in("property_id", propertyIds);
  units = unitRows || [];
}

const { data: tenants } = await supabase.from("tenants").select("id, full_name, unit_id, status").eq("landlord_id", landlordId);
const activeTenants = (tenants || []).filter((t) => t.status === "active");
const tenantIds = activeTenants.map((t) => t.id);

const unpaidLines: string[] = [];
const paidLines: string[] = [];
if (tenantIds.length > 0) {
  const { data: invoices } = await supabase.from("invoices").select("id, tenant_id, total_due, billing_period").in("tenant_id", tenantIds).eq("billing_period", period);
  for (const tenant of activeTenants) {
    const invoice = (invoices || []).find((i) => i.tenant_id === tenant.id);
    if (!invoice) continue;
    const { data: payments } = await supabase.from("payments").select("amount_paid, paid_at").eq("invoice_id", invoice.id);
    const paid = (payments || []).reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
    const balance = Number(invoice.total_due) - paid;
    if (balance > 0) {
      unpaidLines.push(tenant.full_name + " owes KSh " + balance.toLocaleString() + " for " + period);
    } else {
      const lastPaidAt = (payments || []).reduce((latest: string, p: any) => (p.paid_at && p.paid_at > latest ? p.paid_at : latest), "");
      const dateStr = lastPaidAt ? new Date(lastPaidAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "date unknown";
      paidLines.push(tenant.full_name + " paid KSh " + paid.toLocaleString() + " on " + dateStr);
    }
  }
}

const unitIds = units.map((u) => u.id);
let maintenanceLines: string[] = [];
if (unitIds.length > 0) {
  const { data: maintenance } = await supabase.from("maintenance_requests").select("id, category, urgency, status, unit_id").in("unit_id", unitIds).neq("status", "completed");
  maintenanceLines = (maintenance || []).map((m) => {
    const unit = units.find((u) => u.id === m.unit_id);
    return (unit ? unit.unit_number : "unknown unit") + ": " + m.category + " (" + m.urgency + ", " + m.status + ")";
  });
}

const occupied = units.filter((u) => u.status === "occupied").length;
const vacant = units.filter((u) => u.status !== "occupied").length;

const summary = [
  "Billing period: " + period,
  "Properties: " + (properties || []).map((p) => p.property_name).join(", "),
  "Total units: " + units.length + " (occupied: " + occupied + ", vacant: " + vacant + ")",
  "Active tenants: " + activeTenants.length,
  "Unpaid tenants this period: " + (unpaidLines.length > 0 ? unpaidLines.join("; ") : "none - everyone is paid up"),
  "Paid in full this period: " + (paidLines.length > 0 ? paidLines.join(", ") : "none yet"),
  "Open maintenance requests: " + (maintenanceLines.length > 0 ? maintenanceLines.join("; ") : "none"),
].join("\n");

setDataSummary(summary);
}

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
<main className="min-h-screen city-skyline-page">
<div className="h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400" />
<header className="border-b bg-white">
<div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
<div>
<h1 className="text-2xl font-bold text-slate-900">MANAGIKA HOMES</h1>
<p className="text-sm text-slate-500">Property Management Made Simple</p>
</div>
<a href="/landlord/dashboard" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50">Dashboard</a>
</div>
</header>

  <section className="mx-auto max-w-4xl px-6 py-8">
    <div className="mb-8 flex items-center gap-4">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 text-3xl">🤖</span>
      <div>
        <h2 className="text-3xl font-bold text-slate-900">AI Assistant</h2>
        <p className="mt-1 text-slate-500">Ask about your properties, tenants, rent, or maintenance.</p>
      </div>
    </div>

    <div className="rounded-xl border bg-white shadow-sm">
      <div className="max-h-[50vh] min-h-[200px] overflow-y-auto p-6">
        {loading ? (
          <p className="text-slate-500">Loading your data...</p>
        ) : messages.length === 0 ? (
          <p className="text-slate-400">Try asking: "Which tenants haven't paid this month?" or "How many open maintenance requests do I have?"</p>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={m.role === "user" ? "max-w-[80%] whitespace-pre-line rounded-2xl bg-slate-900 px-4 py-3 text-white" : "max-w-[80%] whitespace-pre-line rounded-2xl bg-indigo-50 px-4 py-3 text-slate-800"}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        )}
        {asking && <p className="mt-4 text-slate-400">Thinking...</p>}
      </div>
      <div className="flex gap-3 border-t p-4">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") askQuestion(); }}
          placeholder="Ask a question about your properties..."
          className="flex-1 rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <button onClick={askQuestion} disabled={asking || loading} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50">
          {asking ? "..." : "Ask"}
        </button>
      </div>
    </div>
  </section>

  <footer className="mt-10 border-t bg-white">
    <div className="mx-auto max-w-7xl px-6 py-6 text-sm text-slate-500">© 2026 Managika Homes. Property management made simple.</div>
  </footer>
</main>

);
}
