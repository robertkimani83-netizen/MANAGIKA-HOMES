import { supabaseAdmin } from "@/lib/supabase-admin";

// Best-effort client address. On Vercel the platform sets these headers itself
// (they can't be forged by the caller the way they can on a bare server).
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

// Counts one hit against `key` and says whether the caller is still allowed
// (max hits per windowSeconds). Backed by the rate_limit_hit() database
// function so it works across serverless instances.
//
// Fails OPEN on purpose: if the counter itself is unavailable (e.g. the
// migration hasn't been applied yet, or a database hiccup), real customers
// are never locked out of signing up or paying - we only lose the protection.
export async function allowRequest(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc("rate_limit_hit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] counter unavailable, allowing request:", error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error("[rate-limit] counter failed, allowing request:", e);
    return true;
  }
}
