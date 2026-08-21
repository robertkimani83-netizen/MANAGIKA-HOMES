import { NextResponse } from "next/server";

export async function POST(request: Request) {
try {
const body = await request.json();
const { question, context } = body;

if (!question) {
  return NextResponse.json({ error: "Missing question" }, { status: 400 });
}

const prompt = "You are a helpful assistant inside Managika Homes, a property management app used by landlords and tenants in Kenya. Answer the question using ONLY the data given below. Be concise, friendly, and practical. If the data does not contain the answer, say so honestly instead of guessing.\n\nDATA:\n" + (context || "No data provided.") + "\n\nQUESTION:\n" + question;

const response = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  }
);

const data = await response.json();

if (!response.ok) {
  return NextResponse.json({ error: (data.error && data.error.message) || "Gemini request failed" }, { status: 500 });
}

const answer = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] ? data.candidates[0].content.parts[0].text : "Sorry, I could not come up with an answer.";

return NextResponse.json({ answer });

} catch (error: any) {
return NextResponse.json({ error: error.message || "Failed to get AI response" }, { status: 500 });
}
}
