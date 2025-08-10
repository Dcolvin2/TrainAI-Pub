// app/api/debug/llm/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const { message } = await req.json();
  if (!message) return NextResponse.json({ ok: false, error: "Missing message" }, { status: 400 });

  const prompt = `
Return ONLY JSON that matches:
{
  "name": string,
  "duration_min": number,
  "phases": [
    { "phase": "warmup"|"main"|"accessory"|"conditioning"|"cooldown", "items": [ { "name": string, "sets"?: number|string, "reps"?: number|string, "duration"?: string, "instruction"?: string, "isAccessory"?: boolean } ] }
  ]
}

User: "${message}"
`;

  const resp = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.3,
    max_tokens: 1600,
    messages: [{ role: "user", content: prompt }],
  });

  const text = String(resp?.content?.[0]?.type === "text" ? (resp as any).content[0].text : "");
  return NextResponse.json({ ok: true, raw: text });
}
