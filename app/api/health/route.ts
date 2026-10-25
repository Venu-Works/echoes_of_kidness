import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Liveness only. Database/queue health is monitored separately.
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
