import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Temporarily disabled for Claude integration' });
}

export async function POST() {
  return NextResponse.json({ message: 'Temporarily disabled for Claude integration' });
} 