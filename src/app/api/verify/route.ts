import { NextRequest, NextResponse } from "next/server";
import { verifyBadge } from "@/lib/credly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(input: string | null) {
  if (!input || !input.trim()) {
    return NextResponse.json(
      { status: "error", message: "Provide a Credly badge URL or ID." },
      { status: 400 },
    );
  }
  const result = await verifyBadge(input);
  const httpStatus = result.status === "error" ? 400 : 200;
  return NextResponse.json(result, { status: httpStatus });
}

export async function POST(req: NextRequest) {
  let input: string | null = null;
  try {
    const body = await req.json();
    input = typeof body?.input === "string" ? body.input : null;
  } catch {
    input = null;
  }
  return handle(input);
}

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("q");
  return handle(input);
}
