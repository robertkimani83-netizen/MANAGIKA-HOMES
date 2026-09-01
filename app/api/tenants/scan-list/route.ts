import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Give this route more time than the default (Vercel's default is too
// short for the AI to finish reading a photo) so a scan doesn't get cut off
// mid-request.
export const maxDuration = 60;

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

const MODELS = ["gemini-3.7-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite"];

const SCAN_PROMPT =
  "This image is a page from a handwritten or printed notebook listing tenants and their phone numbers, used by a landlord in Kenya. " +
  "Read every name and phone number you can find on the page, even if the handwriting is messy. " +
  "Output ONLY a plain list, one tenant per line, in the exact format: Full Name, Phone Number " +
  "(for example: John Kamau, 0712345678). " +
  "Keep phone numbers exactly as written (07xx, +254, or 254 formats are all fine). " +
  "Do not add numbering, bullets, headers, or any other text - just the plain list, one entry per line. " +
  "If a name or number is genuinely unreadable, skip that line rather than guessing.";

async function askGemini(model: string, imageBase64: string, mimeType: string) {
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 18000);
let response;
try {
  response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + process.env.GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: SCAN_PROMPT },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        }],
      }),
      signal: controller.signal,
    }
  );
} finally {
  clearTimeout(timeoutId);
}
const data = await response.json();
return { ok: response.ok, data };
}

export async function POST(request: Request) {
try {
const authHeader = request.headers.get("authorization") || "";
const token = authHeader.replace("Bearer ", "").trim();
if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const body = await request.json();
const { imageBase64, mimeType } = body;

if (!imageBase64 || !mimeType) {
  return NextResponse.json({ error: "Missing image data" }, { status: 400 });
}

// The client only lets someone pick an 8MB-or-smaller photo, but that's
// just a UI convenience - nothing stops a signed-in user from calling this
// route directly with a much bigger payload. Base64 inflates raw bytes by
// about a third, so 8MB of photo comes in around 11MB encoded; capping
// here (same idea as the length cap on /api/ai-assistant) keeps every call
// bounded so nobody can run up the Gemini bill by sending huge images
// over and over.
if (String(imageBase64).length > 12 * 1024 * 1024) {
  return NextResponse.json({ error: "That photo is too large. Try again with a smaller image or crop it to just the tenant list." }, { status: 400 });
}
const ALLOWED_SCAN_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
if (!ALLOWED_SCAN_TYPES.includes(String(mimeType))) {
  return NextResponse.json({ error: "Please upload a photo (JPG, PNG, WEBP, or HEIC)." }, { status: 400 });
}

let lastError = "Could not read the document";

for (const model of MODELS) {
  try {
    const result = await askGemini(model, imageBase64, mimeType);
    if (result.ok) {
      const data = result.data;
      const text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] ? data.candidates[0].content.parts[0].text : "";
      return NextResponse.json({ text: (text || "").trim() });
    }
    lastError = (result.data.error && result.data.error.message) || lastError;
    console.error("scan-list: model " + model + " returned an error:", lastError);
  } catch (err: any) {
    lastError = err.name === "AbortError" ? "Timed out waiting for the AI to respond (model: " + model + ")" : (err.message || lastError);
    console.error("scan-list: model " + model + " threw:", lastError);
  }
}

console.error("scan-list: all models failed, last error:", lastError);
return NextResponse.json({ error: lastError }, { status: 500 });

} catch (error: any) {
return NextResponse.json({ error: error.message || "Failed to scan document" }, { status: 500 });
}
}