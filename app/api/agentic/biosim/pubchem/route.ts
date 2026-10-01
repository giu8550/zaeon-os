/**
 * POST /api/agentic/biosim/pubchem
 * Wrapper fino sobre lib/biosim/pubchem (cache + fetches paralelos).
 */
import { NextResponse } from "next/server";
import { resolvePubChem } from "@/lib/biosim/pubchem";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const r = await resolvePubChem(body?.name);
    if (!r.ok) return NextResponse.json({ error: r.error, cid: r.cid }, { status: r.status });
    return NextResponse.json(r);
  } catch (err: any) {
    console.error("PubChem route error:", err);
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
