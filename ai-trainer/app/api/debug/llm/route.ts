// app/api/debug/llm/route.ts
import { NextResponse } from "next/server";
import { openaiJSON } from "@/lib/openaiClient";

export const runtime = "nodejs";

export async function GET() {
  // Quick sanity check so you can visit /api/debug/llm in the browser
  return NextResponse.json({ ok: true, hint: "POST a JSON body: { message: string }" });
}

export async function POST(req: Request) {
  const { message } = await req.json().catch(() => ({}));
  if (!message) {
    return NextResponse.json({ ok: false, error: "Missing message" }, { status: 400 });
  }

  const prompt = `
Return ONLY JSON (no markdown or fences) that matches:
{
  "name": string,
  "duration_min": number,
  "phases": [
    { "phase": "warmup"|"main"|"accessory"|"conditioning"|"cooldown",
      "items": [ { "name": string, "sets"?: number|string, "reps"?: number|string, "duration"?: string, "instruction"?: string, "isAccessory"?: boolean } ]
    }
  ],
  "est_total_minutes"?: number
}

User request: "${message}"
`;

  const resp = await openaiJSON("", prompt, {
    temperature: 0.3,
    max_tokens: 1600,
    model: "gpt-4o"
  });

  return NextResponse.json({ ok: true, raw: JSON.stringify(resp) });
}
