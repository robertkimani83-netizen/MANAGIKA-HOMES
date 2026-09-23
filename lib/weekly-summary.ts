import { supabaseAdmin } from "@/lib/supabase-admin";
import { nairobiPeriod } from "@/lib/period";

// One landlord's week at a glance. Used by the Monday SMS (cron) and by the
// "This week" card on the dashboard, so both always say the same thing.
//
// The "still owed" number follows exactly the same rule as the dashboard's
// Outstanding figure: this month's rent (or this month's invoice if it is
// bigger, e.g. rent + water) minus what was paid, plus any older unpaid
// invoices, for active tenants living in an occupied unit.

export type WeeklySummary = {
  periodLabel: string;
  weekStart: string; // ISO time the 7-day window starts
  receivedAmount: number;
  receivedCount: number;
  owingCount: number;
  owingAmount: number;
  topOwing: { name: string; unit: string; amount: number }[];
  openRepairs: number;
  urgentRepairs: number;
  openComplaints: number;
  vacantUnits: number;
  totalUnits: number;
};

// Supabase/PostgREST puts every id of an .in() list into the URL, so long
// lists are asked for in chunks.
function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function inChunks<T>(ids: string[], run: (part: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (const part of chunk(ids)) {
    const { data, error } = await run(part);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
  }
  return rows;
}

export async function buildWeeklySummary(landlordId: string): Promise<WeeklySummary> {
  const period = nairobiPeriod();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: properties, error: propertiesError } = await supabaseAdmin.from("properties").select("id").eq("landlord_id", landlordId);
  if (propertiesError) throw new Error(propertiesError.message);
  const propertyIds = (properties || []).map((p: any) => p.id as string);

  const [unitRows, tenantsResult, priorResult, recentPaymentsResult] = await Promise.all([
    inChunks<any>(propertyIds, (part) => supabaseAdmin.from("units").select("id, base_rent, status, unit_number").in("property_id", part)),
    supabaseAdmin.from("tenants").select("id, status, full_name, unit_id").eq("landlord_id", landlordId),
    supabaseAdmin
      .from("invoices")
      .select("id, tenant_id, total_due, billing_period, tenants!inner(landlord_id)")
      .eq("tenants.landlord_id", landlordId)
      .neq("status", "paid")
      .neq("billing_period", period),
    supabaseAdmin
      .from("payments")
      .select("amount_paid, invoices!inner(tenants!inner(landlord_id))")
      .eq("invoices.tenants.landlord_id", landlordId)
      .gte("paid_at", since),
  ]);
  if (tenantsResult.error) throw new Error(tenantsResult.error.message);
  if (priorResult.error) throw new Error(priorResult.error.message);
  if (recentPaymentsResult.error) throw new Error(recentPaymentsResult.error.message);

  const units = unitRows as { id: string; base_rent: number; status: string; unit_number: string }[];
  const unitsById: Record<string, (typeof units)[number]> = {};
  for (const u of units) unitsById[u.id] = u;
  const unitIds = units.map((u) => u.id);
  const activeTenants = ((tenantsResult.data || []) as any[]).filter((t) => t.status === "active");
  const allTenantIds = ((tenantsResult.data || []) as any[]).map((t) => t.id as string);
  const priorInvoices = (priorResult.data || []) as any[];

  const [thisPeriodInvoices, priorPayments, repairs, complaints] = await Promise.all([
    inChunks<any>(allTenantIds, (part) => supabaseAdmin.from("invoices").select("id, tenant_id, total_due").in("tenant_id", part).eq("billing_period", period)),
    inChunks<any>(priorInvoices.map((i) => i.id as string), (part) => supabaseAdmin.from("payments").select("invoice_id, amount_paid").in("invoice_id", part)),
    inChunks<any>(unitIds, (part) => supabaseAdmin.from("maintenance_requests").select("id, status, urgency").in("unit_id", part)),
    inChunks<any>(unitIds, (part) => supabaseAdmin.from("complaints").select("id, status").in("unit_id", part)),
  ]);
  const thisPeriodPayments = await inChunks<any>(thisPeriodInvoices.map((i) => i.id as string), (part) =>
    supabaseAdmin.from("payments").select("invoice_id, amount_paid").in("invoice_id", part)
  );

  const paidByInvoice: Record<string, number> = {};
  for (const p of priorPayments) paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] || 0) + (Number(p.amount_paid) || 0);

  const currentTotalByTenant: Record<string, number> = {};
  const invoiceTenant: Record<string, string> = {};
  for (const inv of thisPeriodInvoices) {
    invoiceTenant[inv.id] = inv.tenant_id;
    currentTotalByTenant[inv.tenant_id] = Math.max(currentTotalByTenant[inv.tenant_id] || 0, Number(inv.total_due) || 0);
  }
  const currentPaidByTenant: Record<string, number> = {};
  for (const p of thisPeriodPayments) {
    const tId = invoiceTenant[p.invoice_id];
    if (tId) currentPaidByTenant[tId] = (currentPaidByTenant[tId] || 0) + (Number(p.amount_paid) || 0);
  }

  const owing: { name: string; unit: string; amount: number }[] = [];
  for (const tenant of activeTenants) {
    const unit = tenant.unit_id ? unitsById[tenant.unit_id] : null;
    if (!unit || unit.status !== "occupied") continue;
    const baseExpected = Number(unit.base_rent) || 0;
    if (baseExpected <= 0) continue;
    const expected = Math.max(baseExpected, currentTotalByTenant[tenant.id] || 0);
    const currentBalance = Math.max(expected - (currentPaidByTenant[tenant.id] || 0), 0);
    const priorBalance = priorInvoices
      .filter((inv) => inv.tenant_id === tenant.id)
      .reduce((sum, inv) => sum + Math.max((Number(inv.total_due) || 0) - (paidByInvoice[inv.id] || 0), 0), 0);
    const total = currentBalance + priorBalance;
    if (total > 0) owing.push({ name: tenant.full_name || "Unknown tenant", unit: unit.unit_number || "—", amount: total });
  }
  owing.sort((a, b) => b.amount - a.amount);

  const recent = (recentPaymentsResult.data || []) as any[];
  const openRepairs = repairs.filter((r) => r.status !== "completed");

  return {
    periodLabel: period,
    weekStart: since,
    receivedAmount: recent.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0),
    receivedCount: recent.length,
    owingCount: owing.length,
    owingAmount: owing.reduce((sum, o) => sum + o.amount, 0),
    topOwing: owing.slice(0, 5),
    openRepairs: openRepairs.length,
    urgentRepairs: openRepairs.filter((r) => r.urgency === "urgent").length,
    openComplaints: complaints.filter((c) => c.status !== "resolved").length,
    vacantUnits: units.filter((u) => u.status !== "occupied").length,
    totalUnits: units.length,
  };
}

function kes(n: number) {
  return "KSh " + Math.round(n).toLocaleString("en-US");
}

// Short SMS (plain characters only, so it stays one 160-character message).
export function formatSummarySms(s: WeeklySummary): string {
  const parts: string[] = [];
  parts.push("Managika week: " + kes(s.receivedAmount) + " received (" + s.receivedCount + (s.receivedCount === 1 ? " payment)." : " payments)."));
  parts.push(s.owingCount > 0 ? s.owingCount + " owe " + kes(s.owingAmount) + "." : "Nobody owes rent.");
  const extras: string[] = [];
  if (s.openRepairs > 0) extras.push(s.openRepairs + " repair" + (s.openRepairs === 1 ? "" : "s"));
  if (s.vacantUnits > 0) extras.push(s.vacantUnits + " vacant");
  if (extras.length) parts.push(extras.join(", ") + ".");
  let msg = parts.join(" ");
  if (msg.length + 12 <= 160) msg += " Open app.";
  return msg.length > 160 ? msg.slice(0, 157) + "..." : msg;
}

// Friendlier, longer text for the WhatsApp share button on the dashboard.
export function formatSummaryText(s: WeeklySummary): string {
  const lines: string[] = [];
  lines.push("Managika Homes - my week");
  lines.push("Received this week: " + kes(s.receivedAmount) + " (" + s.receivedCount + (s.receivedCount === 1 ? " payment)" : " payments)"));
  lines.push(s.owingCount > 0 ? "Still owed: " + kes(s.owingAmount) + " from " + s.owingCount + " tenant" + (s.owingCount === 1 ? "" : "s") : "Nobody owes rent");
  if (s.openRepairs > 0) lines.push("Open repairs: " + s.openRepairs + (s.urgentRepairs > 0 ? " (" + s.urgentRepairs + " urgent)" : ""));
  if (s.openComplaints > 0) lines.push("Open complaints: " + s.openComplaints);
  if (s.vacantUnits > 0) lines.push("Vacant units: " + s.vacantUnits + " of " + s.totalUnits);
  return lines.join("\n");
}
