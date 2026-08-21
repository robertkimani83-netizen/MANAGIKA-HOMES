import { NextResponse } from "next/server";

const MODELS = ["gemini-3.7-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite"];

async function askGemini(model: string, prompt: string) {
const response = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + process.env.GEMINI_API_KEY,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  }
);
const data = await response.json();
return { ok: response.ok, data };
}

export async function POST(request: Request) {
try {
const body = await request.json();
const { question, context } = body;

if (!question) {
  return NextResponse.json({ error: "Missing question" }, { status: 400 });
}

const prompt = "You are a helpful assistant inside Managika Homes, a property management app used by landlords and tenants in Kenya. Answer the question using ONLY the data given below. Be concise, friendly, and practical. If the data does not contain the answer, say so honestly instead of guessing. Do not use markdown formatting such as asterisks, bold, or bullet symbols. When your answer includes more than one item (such as tenants, balances, or requests), put each item on its own line by itself instead of running them together in one sentence.\n\nDATA:\n" + (context || "No data provided.") + "\n\nQUESTION:\n" + question;

let lastError = "Gemini request failed";

for (const model of MODELS) {
  try {
    const result = await askGemini(model, prompt);
    if (result.ok) {
      const data = result.data;
      const answer = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] ? data.candidates[0].content.parts[0].text : "Sorry, I could not come up with an answer.";
      return NextResponse.json({ answer });
    }
    lastError = (result.data.error && result.data.error.message) || lastError;
  } catch (err: any) {
    lastError = err.message || lastError;
  }
}

return NextResponse.json({ error: lastError }, { status: 500 });

} catch (error: any) {
return NextResponse.json({ error: error.message || "Failed to get AI response" }, { status: 500 });
}
}
