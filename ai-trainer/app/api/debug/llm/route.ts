// app/api/debug/llm/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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

  const resp = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.3,
    max_tokens: 1600,
    messages: [{ role: "user", content: prompt }],
  });

  // Gather all text blocks from Anthropic response
  const raw = (resp?.content ?? [])
    .map((b: any) => (b && typeof b === "object" && "text" in b ? b.text : ""))
    .join("\n");

  return NextResponse.json({ ok: true, raw });
}
