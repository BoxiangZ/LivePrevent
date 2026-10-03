import { NextRequest, NextResponse } from "next/server";
import { getRun, getStore, listRuns, saveRun, saveStore } from "@/server/store";
import { ingestObservation, parseObservation } from "@/server/observations";

export async function GET(request: NextRequest) {
  const personId = request.nextUrl.searchParams.get("personId") ?? "";
  if (!getStore(personId)) return NextResponse.json({ error: "unknown_person" }, { status: 404 });
  return NextResponse.json({ runs: listRuns(personId) });
}

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const input = parseObservation(raw);
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });
  const store = getStore(input.personId);
  if (!store) return NextResponse.json({ error: "unknown_person" }, { status: 404 });
  const existing = getRun(input.personId, input.idempotencyKey);
  if (existing) return NextResponse.json(existing);
  const result = ingestObservation(store, input);
  const run = { ...result, id: result.runId, idempotencyKey: input.idempotencyKey,
    submittedAt: new Date().toISOString(), input };
  saveStore(store);
  saveRun(run);
  return NextResponse.json(run, { status: 201 });
}
