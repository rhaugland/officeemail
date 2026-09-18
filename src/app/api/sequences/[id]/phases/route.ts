import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { phases } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sequenceId } = await params;
  const { subject, body } = await request.json();

  const [maxPhase] = await getDb()
    .select({ max: sql<number>`coalesce(max(${phases.phaseNumber}), 0)` })
    .from(phases)
    .where(eq(phases.sequenceId, sequenceId));

  const [phase] = await getDb()
    .insert(phases)
    .values({
      sequenceId,
      phaseNumber: (maxPhase?.max || 0) + 1,
      subject,
      body,
      isActive: false,
    })
    .returning();

  return NextResponse.json(phase);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { phaseId, isActive } = await request.json();

  const [updated] = await getDb()
    .update(phases)
    .set({ isActive })
    .where(eq(phases.id, phaseId))
    .returning();

  return NextResponse.json(updated);
}
