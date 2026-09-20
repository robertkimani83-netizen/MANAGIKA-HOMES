import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizePhone, phoneVariants } from "@/lib/tenant-phone";
import { allowRequest, clientIp } from "@/lib/rate-limit";

// Lets a tenant who only has a phone number on file (no email - e.g. bulk
// imported) create their own portal account. No SMS is sent: we already
// trust the number because it matches what the landlord recorded, so the
// account is created pre-confirmed via the admin API, the same way
// link-phone links phone numbers to existing email accounts.
//
// KNOWN LIMITATION: this does not prove the person owns the number, so anyone
// who knows a tenant's number could register it first. Rate limiting below
// only slows guessing. The proper fix is an SMS code like the password-reset
// flow, which needs SMS delivery to Safaricom numbers to be working first.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone: rawPhone, password } = body;

    if (!rawPhone || !password) {
      return NextResponse.json({ error: "Phone number and password are required." }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const phone = normalizePhone(rawPhone);
    if (!phone) {
      return NextResponse.json({ error: "Enter a valid phone number, e.g. 07XXXXXXXX." }, { status: 400 });
    }

    // Public route that can tell someone whether a number is a registered
    // tenant - cap how many numbers one person can try.
    if (!(await allowRequest("tenant-signup:ip:" + clientIp(request), 10, 60 * 60))) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .in("phone_number", phoneVariants(phone))
      .maybeSingle();

    if (tenantError) {
      return NextResponse.json({ error: "Could not verify your phone number. Please try again." }, { status: 500 });
    }
    if (!tenant) {
      return NextResponse.json({ error: "This phone number is not registered as a tenant by your landlord. Please contact them first." }, { status: 404 });
    }

    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      phone,
      password,
      phone_confirm: true,
    });

    if (createError) {
      const alreadyExists = /already|exists|registered/i.test(createError.message || "");
      return NextResponse.json(
        { error: alreadyExists ? "An account with this phone number already exists. Please sign in instead." : createError.message },
        { status: alreadyExists ? 409 : 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create account" }, { status: 500 });
  }
}
