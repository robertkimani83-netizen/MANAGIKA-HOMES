import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildWeeklySummary, formatSummaryText } from "@/lib/weekly-summary";
import { allowRequest } from "@/lib/rate-limit";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

// The signed-in landlord's own week: money in, money owed, repairs, vacancies.
// Always for the caller's own account (landlord id = their login id).
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const landlordId = userData.user.id;

    if (!(await allowRequest("weekly-summary:user:" + landlordId, 60, 3600))) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const summary = await buildWeeklySummary(landlordId);
    return NextResponse.json({ summary, message: formatSummaryText(summary) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load weekly summary" }, { status: 500 });
  }
}
