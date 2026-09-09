import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

async function getLandlordId(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

function currentPeriod() {
  const d = new Date();
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return names[d.getMonth()] + " " + d.getFullYear();
}

// water_readings has no client-facing RLS policies on purpose (see the
// migration that created it) - a landlord's own client-side supabase
// calls would just get denied. This route, using supabaseAdmin, is the
// only way in or out, same pattern as the staff/documents routes.

// GET /api/water-readings?tenantId=... - reading history for this
// tenant's current unit, most recent first. Used to show a tenant's past
// meter readings on their profile page.
export async function GET(request: Request) {
  const landlordId = await getLandlordId(request);
  if (!landlordId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("id, unit_id, units(water_rate)")
    .eq("id", tenantId)
    .eq("landlord_id", landlordId)
    .maybeSingle();
  if (!tenant || !tenant.unit_id) {
    return NextResponse.json({ readings: [], waterRate: 0 });
  }

  const { data: readings, error } = await supabaseAdmin
    .from("water_readings")
    .select("id, billing_period, reading, created_at")
    .eq("unit_id", tenant.unit_id)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const waterRate = Number((tenant as any).units?.water_rate) || 0;
  return NextResponse.json({ readings: readings || [], waterRate });
}

// POST /api/water-readings { tenantId, reading } - landlord records this
// period's meter reading for the tenant's unit. Consumption is worked
// out against the most recent previous reading for that same unit
// (reading - previous reading, floored at 0 so a meter reset or a typo
// never produces a negative bill), multiplied by the unit's water_rate
// (KSh per unit of consumption), then folded into that tenant's invoice
// for the current billing period - the same lazy get-or-create pattern
// /payments uses for rent. A unit's very first ever reading has nothing
// to compare against, so it's stored as a baseline with no charge.
export async function POST(request: Request) {
  const landlordId = await getLandlordId(request);
  if (!landlordId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const tenantId = (body.tenantId || "").toString();
  const reading = Number(body.reading);

  if (!tenantId) return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
  if (!Number.isFinite(reading) || reading < 0) {
    return NextResponse.json({ error: "Please enter a valid meter reading." }, { status: 400 });
  }

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select("id, unit_id, units(id, base_rent, water_rate)")
    .eq("id", tenantId)
    .eq("landlord_id", landlordId)
    .maybeSingle();
  if (tenantError) return NextResponse.json({ error: tenantError.message }, { status: 500 });
  if (!tenant || !tenant.unit_id || !(tenant as any).units) {
    return NextResponse.json({ error: "This tenant has no unit assigned yet." }, { status: 400 });
  }

  const unit = (tenant as any).units;
  const unitId = tenant.unit_id;
  const waterRate = Number(unit.water_rate) || 0;
  const billingPeriod = currentPeriod();

  const { data: previous, error: previousError } = await supabaseAdmin
    .from("water_readings")
    .select("reading")
    .eq("unit_id", unitId)
    .neq("billing_period", billingPeriod)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousError) return NextResponse.json({ error: previousError.message }, { status: 500 });

  const previousReading = previous ? Number(previous.reading) : null;
  const consumption = previousReading !== null ? Math.max(reading - previousReading, 0) : 0;
  const waterAmount = Math.round(consumption * waterRate * 100) / 100;

  const { error: upsertError } = await supabaseAdmin
    .from("water_readings")
    .upsert({ unit_id: unitId, billing_period: billingPeriod, reading }, { onConflict: "unit_id,billing_period" });
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  const rent = Number(unit.base_rent) || 0;

  const { data: existingInvoice, error: invoiceLookupError } = await supabaseAdmin
    .from("invoices")
    .select("id, rent_amount")
    .eq("tenant_id", tenantId)
    .eq("billing_period", billingPeriod)
    .maybeSingle();
  if (invoiceLookupError) return NextResponse.json({ error: invoiceLookupError.message }, { status: 500 });

  let invoiceId = existingInvoice?.id;
  const rentAmount = existingInvoice ? Number(existingInvoice.rent_amount) : rent;
  const totalDue = rentAmount + waterAmount;

  if (!invoiceId) {
    const dueDate = new Date();
    const { data: newInvoice, error: invError } = await supabaseAdmin
      .from("invoices")
      .insert({
        invoice_number: "INV-" + Date.now(),
        tenant_id: tenantId,
        unit_id: unitId,
        billing_period: billingPeriod,
        rent_amount: rent,
        water_amount: waterAmount,
        total_due: totalDue,
        status: "unpaid",
        due_date: dueDate.toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (invError || !newInvoice) return NextResponse.json({ error: invError?.message || "Could not create invoice" }, { status: 500 });
    invoiceId = newInvoice.id;
  } else {
    const { error: updateError } = await supabaseAdmin
      .from("invoices")
      .update({ water_amount: waterAmount, total_due: totalDue })
      .eq("id", invoiceId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    const { data: invoicePayments } = await supabaseAdmin.from("payments").select("amount_paid").eq("invoice_id", invoiceId);
    const totalPaid = (invoicePayments || []).reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
    let newStatus = "unpaid";
    if (totalPaid >= totalDue) newStatus = "paid";
    else if (totalPaid > 0) newStatus = "partially_paid";
    await supabaseAdmin.from("invoices").update({ status: newStatus }).eq("id", invoiceId);
  }

  return NextResponse.json({
    success: true,
    billingPeriod,
    previousReading,
    consumption,
    waterRate,
    waterAmount,
    totalDue,
  });
}
