import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const envKeys = Object.keys(process.env).filter(
    k => !k.toLowerCase().includes("key") && !k.toLowerCase().includes("secret")
  );
  
  const body = {
    ok: true,
    message: "API is reachable",
    time: new Date().toISOString(),
    runtime: "nodejs",
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    openaiConfigured: hasOpenAI,
    envKeys,
  };
  
  console.log("health:", {
    openaiConfigured: hasOpenAI,
    runtime: "nodejs",
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
  
  return NextResponse.json(body);
}